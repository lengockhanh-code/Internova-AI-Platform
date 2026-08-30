import styles from "./student-mascot.module.css";


export default function StudentMascot() {
    return (
        <div
            aria-hidden="true"
            className={styles.mascot}
        >
            <svg
                className={styles.mascotSvg}
                focusable="false"
                viewBox="0 0 200 260"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient
                        id="inno-owl-body"
                        x1="54"
                        x2="151"
                        y1="117"
                        y2="228"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#2f7bdc" />
                        <stop offset="1" stopColor="#0b356b" />
                    </linearGradient>
                    <linearGradient
                        id="inno-owl-book"
                        x1="61"
                        x2="143"
                        y1="170"
                        y2="219"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#f45b69" />
                        <stop offset="1" stopColor="#bd263c" />
                    </linearGradient>
                    <linearGradient
                        id="inno-owl-wing"
                        x1="48"
                        x2="181"
                        y1="91"
                        y2="193"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#3f87d7" />
                        <stop offset=".52" stopColor="#15579f" />
                        <stop offset="1" stopColor="#0a376f" />
                    </linearGradient>
                    <linearGradient
                        id="inno-owl-cap"
                        x1="67"
                        x2="133"
                        y1="28"
                        y2="76"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#164f90" />
                        <stop offset="1" stopColor="#071f43" />
                    </linearGradient>
                    <radialGradient
                        id="inno-owl-face"
                        cx="0"
                        cy="0"
                        r="1"
                        gradientTransform="translate(83 70) rotate(55) scale(94 104)"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop stopColor="#f7fbff" />
                        <stop offset="1" stopColor="#cbdcf2" />
                    </radialGradient>
                </defs>

                <g className={styles.sparkles}>
                    <path d="M27 75v14M20 82h14" />
                    <path d="M171 45v10M166 50h10" />
                    <circle cx="34" cy="56" r="2.5" />
                </g>

                <g className={styles.waveLines}>
                    <path d="M171 72c8 4 12 10 13 18" />
                    <path d="M179 61c11 6 17 14 18 25" />
                </g>

                <ellipse
                    className={styles.groundShadow}
                    cx="103"
                    cy="239"
                    rx="65"
                    ry="10"
                />

                <g className={styles.feet}>
                    <path d="M68 215c-12 3-18 10-16 16 8 3 19 2 29-5l2-10Z" />
                    <path d="M132 215c12 3 18 10 16 16-8 3-19 2-29-5l-2-10Z" />
                </g>

                <g className={styles.body}>
                    <ellipse
                        cx="100"
                        cy="173"
                        rx="59"
                        ry="62"
                        fill="url(#inno-owl-body)"
                        stroke="#082f61"
                        strokeWidth="3"
                    />
                    <path
                        d="M68 151c10 12 21 17 32 17s22-5 32-17v60c-8 12-18 19-32 19s-24-7-32-19Z"
                        fill="#edf5ff"
                    />
                    <path
                        d="M84 149c3 10 8 15 16 15s13-5 16-15"
                        fill="none"
                        stroke="#a9c5e8"
                        strokeLinecap="round"
                        strokeWidth="3"
                    />
                    <path
                        d="M54 149c-6 26 0 49 17 67"
                        fill="none"
                        opacity=".34"
                        stroke="#a9d4ff"
                        strokeLinecap="round"
                        strokeWidth="4"
                    />
                    <path
                        d="M89 151v18M111 151v18"
                        fill="none"
                        stroke="#e9f4ff"
                        strokeLinecap="round"
                        strokeWidth="3"
                    />
                    <circle cx="100" cy="187" r="13" fill="#ffffff" />
                    <path
                        d="m100 178 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"
                        fill="#f4b740"
                    />
                </g>

                <g className={styles.bookWing}>
                    <path
                        d="M57 139c-16 7-24 24-19 43 3 12 10 21 22 26l18-21-4-41Z"
                        fill="url(#inno-owl-wing)"
                        stroke="#0b376d"
                        strokeLinejoin="round"
                        strokeWidth="3"
                    />
                    <path
                        d="M58 151c-9 9-10 25-3 37"
                        fill="none"
                        stroke="#79ace5"
                        strokeLinecap="round"
                        strokeWidth="3"
                    />
                </g>

                <g className={styles.waveWing}>
                    <path
                        d="M142 145c12-12 19-27 19-43 0-12-3-22-7-31 10 2 17 10 21 22 5-7 11-9 16-6 2 10-2 20-10 28 7-1 12 2 14 7-9 17-23 29-41 36Z"
                        fill="url(#inno-owl-wing)"
                        stroke="#0b376d"
                        strokeLinejoin="round"
                        strokeWidth="3"
                    />
                    <path
                        d="M163 102c4 5 8 8 13 10M174 93c2 5 5 8 9 11M177 115c3 3 7 5 11 6"
                        fill="none"
                        stroke="#8cb9ec"
                        strokeLinecap="round"
                        strokeWidth="3"
                    />
                </g>

                <g className={styles.book}>
                    <path
                        d="M58 171c14-4 28-2 42 6v46c-13-7-27-9-42-5Z"
                        fill="url(#inno-owl-book)"
                        stroke="#8e1c31"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                    <path
                        d="M142 171c-14-4-28-2-42 6v46c13-7 27-9 42-5Z"
                        fill="#e84355"
                        stroke="#8e1c31"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                    <path d="M100 177v46" stroke="#8e1c31" strokeWidth="2" />
                    <path
                        d="M70 184c7-1 14 0 20 3M70 192c7-1 14 0 20 3M110 187c6-3 13-4 20-3M110 195c6-3 13-4 20-3"
                        fill="none"
                        stroke="#ffe8ea"
                        strokeLinecap="round"
                        strokeWidth="2"
                    />
                </g>

                <g className={styles.head}>
                    <path d="M48 66 48 29 75 51Z" fill="#153f78" />
                    <path d="m152 66 0-37-27 22Z" fill="#153f78" />
                    <path d="m53 55 2-16 12 13ZM147 55l-2-16-12 13Z" fill="#75a7df" />
                    <ellipse
                        cx="100"
                        cy="91"
                        rx="60"
                        ry="55"
                        fill="url(#inno-owl-face)"
                        stroke="#0c315f"
                        strokeWidth="4"
                    />
                    <path
                        d="M49 82c9-19 25-29 48-31-13 13-18 27-17 43-12-2-22-6-31-12ZM151 82c-9-19-25-29-48-31 13 13 18 27 17 43 12-2 22-6 31-12Z"
                        fill="#316fae"
                        opacity=".88"
                    />

                    <g className={styles.eyes}>
                        <ellipse cx="75" cy="88" rx="20" ry="23" fill="#ffffff" />
                        <ellipse cx="125" cy="88" rx="20" ry="23" fill="#ffffff" />
                        <g className={styles.pupils}>
                            <circle cx="79" cy="91" r="9" fill="#102f58" />
                            <circle cx="121" cy="91" r="9" fill="#102f58" />
                            <circle cx="82" cy="87" r="3" fill="#ffffff" />
                            <circle cx="124" cy="87" r="3" fill="#ffffff" />
                        </g>
                    </g>

                    <g className={styles.glasses}>
                        <ellipse cx="75" cy="88" rx="23" ry="26" />
                        <ellipse cx="125" cy="88" rx="23" ry="26" />
                        <path d="M98 86c1-2 3-2 4 0M52 84l-10-5M148 84l9-5" />
                    </g>

                    <path
                        d="M89 111 100 102l11 9-11 13Z"
                        fill="#f4b740"
                        stroke="#d99222"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                    <path
                        d="M86 127c8 7 20 7 28 0"
                        fill="none"
                        stroke="#163b68"
                        strokeLinecap="round"
                        strokeWidth="3"
                    />
                    <ellipse cx="62" cy="113" rx="8" ry="4" fill="#f0808b" opacity=".62" />
                    <ellipse cx="138" cy="113" rx="8" ry="4" fill="#f0808b" opacity=".62" />

                    <g className={styles.cap}>
                        <path
                            d="m50 47 50-23 50 23-50 23Z"
                            fill="url(#inno-owl-cap)"
                            stroke="#061b38"
                            strokeLinejoin="round"
                            strokeWidth="3"
                        />
                        <path
                            d="M70 57v18c16 10 44 10 60 0V57l-30 13Z"
                            fill="#123f76"
                            stroke="#061b38"
                            strokeLinejoin="round"
                            strokeWidth="2"
                        />
                        <path d="M100 24v9" stroke="#f4b740" strokeWidth="3" />
                        <g className={styles.tassel}>
                            <path d="M100 29c20 2 31 8 32 22" fill="none" stroke="#f4b740" strokeWidth="3" />
                            <circle cx="132" cy="55" r="5" fill="#f4b740" />
                            <path d="m128 59-4 15M132 60v16M136 59l4 15" stroke="#f4b740" strokeLinecap="round" strokeWidth="2" />
                        </g>
                    </g>
                </g>
            </svg>
        </div>
    );
}
