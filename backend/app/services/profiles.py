import json
from sqlalchemy.orm import Session
from app.core.config import BACKEND_DIR
from app.models.user_profile import UserProfile
from app.schemas.companion import ProfileData

DEMO_PROFILE_ID = 1


def seed_demo_profile(session: Session) -> None:
    """Insert fictional test data only when demo profile 1 does not exist."""
    if session.get(UserProfile, DEMO_PROFILE_ID) is None:
        raw = json.loads((BACKEND_DIR / 'data' / 'demo_profile.json').read_text(encoding='utf-8'))
        data = ProfileData.model_validate(raw)
        session.add(UserProfile(id=DEMO_PROFILE_ID, **data.model_dump()))
        session.commit()


def get_demo_profile(session: Session) -> ProfileData:
    profile = session.get(UserProfile, DEMO_PROFILE_ID)
    if profile is None:
        raise ProfileNotFound('Demo user profile is missing')
    return ProfileData.model_validate(profile)


class ProfileNotFound(Exception):
    pass
