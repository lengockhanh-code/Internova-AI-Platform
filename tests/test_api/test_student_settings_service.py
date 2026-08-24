from src.services.student_settings_service import update_student_profile


class _FakeDb:
    def __init__(self):
        self.statements = []
        self.committed = False

    def execute(self, statement, params=None):
        self.statements.append((str(statement), params))

    def commit(self):
        self.committed = True


def test_update_student_profile_does_not_insert_profile_without_student_code():
    db = _FakeDb()

    update_student_profile(
        db=db,
        student_id=2,
        full_name="Nguyen Van A",
        phone="0902000001",
        faculty="College of Engineering and Computer Science",
        major="Computer Science",
        cohort="2026",
    )

    statements = [
        sql
        for sql, _params
        in db.statements
    ]

    assert any("UPDATE users" in sql for sql in statements)
    assert any("UPDATE student_profiles" in sql for sql in statements)
    assert not any("INSERT INTO student_profiles" in sql for sql in statements)
    assert db.committed is True
