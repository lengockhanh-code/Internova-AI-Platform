from src.services import internship_profile_service


class _FakeMappingsResult:
    def __init__(self, rows):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class _FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return _FakeMappingsResult(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeDb:
    def __init__(self, student_row):
        self._student_row = student_row

    def execute(self, statement, _params=None):
        sql = str(statement)
        if "FROM users AS u" in sql:
            return _FakeExecuteResult([self._student_row])

        return _FakeExecuteResult([])


def test_internship_profile_uses_avatar_endpoint_when_binary_avatar_exists(monkeypatch):
    monkeypatch.setattr(
        internship_profile_service,
        "get_student_internship",
        lambda db, student_id: None,
    )

    profile = internship_profile_service.get_internship_profile(
        db=_FakeDb(
            {
                "id": 1,
                "full_name": "Nguyen Van A",
                "email": "student@example.com",
                "phone": None,
                "avatar_url": None,
                "avatar_data": b"image-bytes",
                "student_code": "S001",
            }
        ),
        student_id=1,
    )

    assert profile["student"]["avatarUrl"] == "/api/v1/student/settings/avatar"


def test_internship_profile_keeps_legacy_avatar_url_without_binary_avatar(monkeypatch):
    monkeypatch.setattr(
        internship_profile_service,
        "get_student_internship",
        lambda db, student_id: None,
    )

    profile = internship_profile_service.get_internship_profile(
        db=_FakeDb(
            {
                "id": 1,
                "full_name": "Nguyen Van A",
                "email": "student@example.com",
                "phone": None,
                "avatar_url": "https://example.com/avatar.png",
                "avatar_data": None,
                "student_code": "S001",
            }
        ),
        student_id=1,
    )

    assert profile["student"]["avatarUrl"] == "https://example.com/avatar.png"
