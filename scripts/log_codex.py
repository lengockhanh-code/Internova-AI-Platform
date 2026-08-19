#!/usr/bin/env python3
"""
Codex log scanner.

Extract user prompts from:
    ~/.codex/sessions/**/rollout-*.jsonl

Write:
    .ai-log/session.jsonl
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path


# Windows UTF-8 console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(
            encoding="utf-8",
            errors="replace"
        )
        sys.stderr.reconfigure(
            encoding="utf-8",
            errors="replace"
        )
    except Exception:
        pass


CODEX_HOME = Path.home() / ".codex"
SESSION_DIR = CODEX_HOME / "sessions"

VN_TZ = timezone(timedelta(hours=7))


# ==============================
# Git metadata
# ==============================

def git(cmd):

    try:
        return subprocess.check_output(
            cmd.split(),
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()

    except Exception:
        return ""



# ==============================
# Fix mojibake
# ==============================

def repair_mojibake(text):

    if not isinstance(text, str):
        return text

    bad_chars = [
        "Ã",
        "Æ",
        "á»",
        "Ä"
    ]

    if not any(
        x in text
        for x in bad_chars
    ):
        return text


    try:

        return text.encode(
            "latin1"
        ).decode(
            "utf-8"
        )

    except Exception:

        return text



# ==============================
# Find rollout files
# ==============================

def find_rollouts(hours=24, all_sessions=False):

    files = list(
        SESSION_DIR.rglob(
            "rollout-*.jsonl"
        )
    )


    if not files:
        return []


    files.sort(
        key=lambda x: x.stat().st_mtime,
        reverse=True
    )


    if all_sessions:
        return files


    cutoff = datetime.now(
        timezone.utc
    ) - timedelta(
        hours=hours
    )


    result = []


    for f in files:

        modified = datetime.fromtimestamp(
            f.stat().st_mtime,
            timezone.utc
        )

        if modified >= cutoff:

            result.append(f)


    return result



# ==============================
# Existing logs
# ==============================

def get_logged_ids(log_file):

    ids = set()


    if not log_file.exists():
        return ids


    with open(
        log_file,
        encoding="utf-8"
    ) as f:


        for line in f:

            try:

                obj = json.loads(line)

                if obj.get("entry_id"):
                    ids.add(
                        obj["entry_id"]
                    )

            except Exception:
                pass


    return ids



# ==============================
# Extract prompts
# ==============================

def extract_user_prompts(
    path,
    debug=False
):

    prompts = []


    with open(
        path,
        encoding="utf-8"
    ) as f:


        for line in f:


            try:

                data = json.loads(line)

            except json.JSONDecodeError:

                continue



            if data.get(
                "type"
            ) != "event_msg":

                continue



            payload = data.get(
                "payload",
                {}
            )


            if payload.get(
                "type"
            ) != "user_message":

                continue



            message = payload.get(
                "message",
                ""
            )


            if not message:
                continue



            if isinstance(
                message,
                dict
            ):

                message = (
                    message.get("content")
                    or
                    message.get("text")
                    or
                    ""
                )


            if not isinstance(
                message,
                str
            ):
                continue



            message = repair_mojibake(
                message.strip()
            )



            # bỏ transcript generated
            blacklist = [
                "The following is the Codex agent history",
                "TRANSCRIPT START",
                "TRANSCRIPT END"
            ]


            if any(
                x in message
                for x in blacklist
            ):
                continue



            if debug:

                print(
                    "[DEBUG]",
                    repr(message[:120])
                )



            prompts.append(
                message
            )


    return prompts



# ==============================
# Build entry
# ==============================

def build_entry(prompt):

    repo_url = git(
        "git remote get-url origin"
    )


    branch = git(
        "git rev-parse --abbrev-ref HEAD"
    )


    commit = git(
        "git rev-parse --short HEAD"
    )


    student = (
        git(
            "git config user.email"
        )
        or
        os.environ.get(
            "USERNAME",
            "unknown"
        )
    )


    entry_id = hashlib.sha256(
        (
            "codex:"
            +
            prompt
            +
            repo_url
            +
            branch
        ).encode(
            "utf-8"
        )
    ).hexdigest()



    return {

        "ts":
            datetime.now(
                VN_TZ
            ).isoformat(),

        "tool":
            "codex",

        "event":
            "UserPrompt",

        "entry_id":
            entry_id,

        "model":
            "codex",

        "repo":
            (
                repo_url.split("/")[-1]
                .replace(".git","")
                if repo_url
                else Path.cwd().name
            ),

        "branch":
            branch,

        "commit":
            commit,

        "student":
            student,

        "prompt":
            prompt,

        "response_summary":
            ""

    }



# ==============================
# Main
# ==============================

def main():

    parser = argparse.ArgumentParser()


    parser.add_argument(
        "--auto",
        action="store_true"
    )


    parser.add_argument(
        "--all",
        action="store_true"
    )


    parser.add_argument(
        "--hours",
        type=int,
        default=24
    )


    parser.add_argument(
        "--debug",
        action="store_true"
    )


    parser.add_argument(
        "--dry-run",
        action="store_true"
    )


    args = parser.parse_args()



    rollouts = find_rollouts(
        hours=args.hours,
        all_sessions=args.all
    )


    if not rollouts:

        print(
            "[codex-log] No rollout found"
        )

        return



    log_dir = Path(
        os.environ.get(
            "AI_LOG_DIR",
            ".ai-log"
        )
    )


    log_dir.mkdir(
        exist_ok=True
    )


    log_file = (
        log_dir /
        "session.jsonl"
    )


    logged_ids = get_logged_ids(
        log_file
    )


    new_entries = []



    for rollout in rollouts:


        for prompt in extract_user_prompts(
            rollout,
            debug=args.debug
        ):


            entry = build_entry(
                prompt
            )


            if entry["entry_id"] in logged_ids:
                continue


            logged_ids.add(
                entry["entry_id"]
            )


            new_entries.append(
                entry
            )



    if not new_entries:

        print(
            "[codex-log] No new prompts."
        )

        return



    if args.dry_run:

        print(
            f"Would log {len(new_entries)} prompts"
        )

        return



    with open(
        log_file,
        "a",
        encoding="utf-8"
    ) as f:


        for entry in new_entries:

            f.write(
                json.dumps(
                    entry,
                    ensure_ascii=False
                )
                +
                "\n"
            )



    print(
        f"[codex-log] Logged {len(new_entries)} prompt(s)."
    )



if __name__ == "__main__":
    main()