from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# SQLite database path
DATABASE_URL = "sqlite:///./gateway.db"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Required for SQLite in multithreaded contexts
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    Database session dependency injection.
    Ensures the session is closed cleanly after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
