"""
Configuration settings for the RAG application.
This file stores all API keys and other configuration values.
"""

import os

# API Keys
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY",
                               "AIzaSyAv7pQdqIDyuXtx7dr_c7zYjtDxJzjrG_A")
SERPER_API_KEY = os.environ.get("SERPER_API_KEY",
                               "3e40d39091065b38769f1bd14ebfc7c187a75cf9")
EXA_API_KEY = os.environ.get("EXA_API_KEY",
                            "5a01507e-1d60-4823-8283-b63d43982387")

# Qdrant Configuration
QDRANT_URL = os.environ.get(
    "QDRANT_URL",
    "https://c80e538a-275e-4ece-89e6-0a373ae9441b.us-east4-0.gcp.cloud.qdrant.io:6333"
)
QDRANT_API_KEY = os.environ.get(
    "QDRANT_API_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.4m0kbqDF0xVKXD3ImCCGEa9FNxc-1psSycmWwuMm38I"
)
QDRANT_COLLECTION_NAME = os.environ.get("QDRANT_COLLECTION_NAME",
                                       "knowledge-base")

# Application Settings
VECTOR_SIZE = 768  # Dimensions for the embedding vectors
CHUNK_SIZE = 4000  # Maximum characters per chunk
CHUNK_OVERLAP = 200  # Characters of overlap between chunks

# File upload settings
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {
    'txt': ['text/plain'],
    'pdf': ['application/pdf'],
    'mp3': ['audio/mpeg'],
    'wav': ['audio/wav', 'audio/x-wav'],
    'jpg': ['image/jpeg'],
    'jpeg': ['image/jpeg'],
    'png': ['image/png'],
}
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20MB max upload size
