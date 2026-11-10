from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy.orm import Session

from database import get_db

import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=schemas.UserOut, status_code=201)


def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = user_in.role if user_in.role in ("user", "admin", "employee") else "user"

    user = models.User(
        name=user_in.name,

        email=user_in.email,

        hashed_password=auth_utils.hash_password(user_in.password),

        role=role,

    )

    db.add(user)

    db.commit()

    db.refresh(user)

    return user


@router.post("/login", response_model=schemas.Token)


def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()

    if not user or not auth_utils.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = auth_utils.create_access_token(data={"sub": str(user.id)})

    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserOut)


def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return current_user
