import uuid
import logging
import datetime
from config import QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION_NAME, VECTOR_SIZE
from qdrant_client import QdrantClient
import qdrant_client.http.models as models
from utils.ai import generate_title_for_content

logger = logging.getLogger(__name__)

class QdrantService:
    def __init__(self, url=QDRANT_URL, api_key=QDRANT_API_KEY, collection_name=QDRANT_COLLECTION_NAME):
        self.url = url
        self.api_key = api_key
        self.collection_name = collection_name
        self.client = self._initialize_client()
        self._ensure_collection_exists()

    def _initialize_client(self):
        """Initialize the Qdrant client."""
        try:
            client = QdrantClient(url=self.url, api_key=self.api_key)
            logger.info(f"Connected to Qdrant at {self.url}")
            return client
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant client: {str(e)}")
            raise

    def _ensure_collection_exists(self):
        """Ensure that the collection exists, create it if it doesn't."""
        try:
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            
            if self.collection_name not in collection_names:
                # Create a collection with the correct vector configuration
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config={
                        "fast-bge-base-en-v1.5": models.VectorParams(
                            size=VECTOR_SIZE,  # BGE model embeddings size
                            distance=models.Distance.COSINE
                        )
                    }
                )
                logger.info(f"Created collection '{self.collection_name}'")
            else:
                # Check if the collection has the correct vector configuration
                collection_info = self.client.get_collection(self.collection_name)
                has_correct_vector = False
                
                try:
                    vectors_config = collection_info.config.params.vectors
                    if isinstance(vectors_config, dict) and "fast-bge-base-en-v1.5" in vectors_config:
                        has_correct_vector = True
                    elif hasattr(vectors_config, "name") and vectors_config.name == "fast-bge-base-en-v1.5":
                        has_correct_vector = True
                except AttributeError:
                    pass
                
                if not has_correct_vector:
                    logger.warning(f"Collection '{self.collection_name}' exists but doesn't have the correct vector configuration.")
                    # We can't modify a collection's vector configuration after creation
                    # For safety, we'll still use the existing collection
                else:
                    logger.info(f"Collection '{self.collection_name}' already exists with correct vector configuration")
        except Exception as e:
            logger.error(f"Error ensuring collection exists: {str(e)}")
            raise

    def add_document(self, document_data):
        """
        Add a document to the collection and return its ID.
        
        If document_data is a string, treat it as the text content.
        If document_data is a dictionary, it should have at least a 'text' field,
        and can optionally include metadata like 'title', 'source', etc.
        """
        try:
            # Generate a unique ID for the document
            doc_id = str(uuid.uuid4())
            
            # Check if we're getting just text or a dictionary with metadata
            if isinstance(document_data, str):
                # It's a simple text string
                document_text = document_data
                metadata = {}
            elif isinstance(document_data, bytes):
                # It's binary data, convert to string
                try:
                    document_text = document_data.decode('utf-8')
                except UnicodeDecodeError:
                    document_text = document_data.decode('utf-8', errors='replace')
                metadata = {}
            elif isinstance(document_data, dict) and 'text' in document_data:
                # It's a dictionary with text and metadata
                document_text = document_data['text']
                # If text is bytes, convert to string
                if isinstance(document_text, bytes):
                    try:
                        document_text = document_text.decode('utf-8')
                    except UnicodeDecodeError:
                        document_text = document_text.decode('utf-8', errors='replace')
                metadata = {k: v for k, v in document_data.items() if k != 'text'}
            else:
                raise ValueError("Document data must be a string, bytes, or a dictionary with a 'text' field")
            
            # Create a clean preview by removing extra whitespace
            clean_text = ' '.join(document_text.split())
            # Truncate the document preview for metadata (keep first 150 chars)
            doc_preview = clean_text[:150] + "..." if len(clean_text) > 150 else clean_text
            
            # Create timestamp for upload time if not provided
            if 'timestamp' not in metadata:
                metadata['timestamp'] = datetime.datetime.now().isoformat()
            
            # Add basic metadata if not provided
            if 'preview' not in metadata:
                metadata['preview'] = doc_preview
            if 'size' not in metadata:
                metadata['size'] = len(document_text)
            if 'chars' not in metadata:
                metadata['chars'] = len(document_text)
            if 'words' not in metadata:
                metadata['words'] = len(document_text.split())
            if 'lines' not in metadata:
                metadata['lines'] = len(document_text.splitlines())
                
            # Generate title if not provided
            if 'title' not in metadata or not metadata['title']:
                try:
                    # Generate a title using Gemini
                    metadata['title'] = generate_title_for_content(document_text)
                    logger.info(f"Generated title: {metadata['title']}")
                except Exception as e:
                    logger.warning(f"Error generating title: {str(e)}")
                    # Use the first 30 characters of the text as a fallback title
                    first_line = document_text.strip().split('\n')[0]
                    metadata['title'] = (first_line[:30] + '...') if len(first_line) > 30 else first_line
            
            # Make sure document_text is a string, not bytes
            if isinstance(document_text, bytes):
                try:
                    document_text = document_text.decode('utf-8')
                except UnicodeDecodeError:
                    # If decoding as UTF-8 fails, try a more lenient approach
                    document_text = document_text.decode('utf-8', errors='replace')
                    
            # Generate embedding for the document text using fastembed
            from fastembed import TextEmbedding
            
            # Initialize the embedding model
            embedding_model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
            
            # Generate embeddings for the document text
            embeddings = list(embedding_model.embed([document_text]))
            vector = embeddings[0].tolist()
            
            # Update metadata to include text for retrieval
            metadata['text'] = document_text
            
            # Add the document to the collection with vectors and metadata
            self.client.upsert(
                collection_name=self.collection_name,
                points=[
                    models.PointStruct(
                        id=doc_id,
                        vector={"fast-bge-base-en-v1.5": vector},
                        payload=metadata
                    )
                ]
            )
            
            logger.info(f"Added document with ID {doc_id}")
            return doc_id
        except Exception as e:
            logger.error(f"Error adding document: {str(e)}")
            raise

    def query(self, query_text, limit=3):
        """Query for similar documents."""
        try:
            from fastembed import TextEmbedding
            
            # Initialize the embedding model
            embedding_model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
            
            # Generate the embedding for the query text
            embeddings = list(embedding_model.embed([query_text]))
            query_vector = embeddings[0].tolist()
            
            # Search using the vector directly
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=("fast-bge-base-en-v1.5", query_vector),
                limit=limit
            )
            
            # Process the results
            documents = []
            for result in search_result:
                if hasattr(result, 'payload') and result.payload:
                    # Get the text from the payload if available
                    documents.append(result.payload.get('text', str(result.payload)))
                else:
                    # If no payload, return the vector ID
                    documents.append(f"Document {result.id}")
            
            logger.info(f"Retrieved {len(documents)} documents for query: {query_text[:50]}...")
            return documents
        except Exception as e:
            logger.error(f"Error querying documents: {str(e)}")
            return []

    def get_collection_info(self):
        """Get information about the collection."""
        try:
            return self.client.get_collection(self.collection_name)
        except Exception as e:
            logger.error(f"Error getting collection info: {str(e)}")
            raise
    
    def list_documents(self, limit=100, offset=0):
        """List all documents in the collection with their metadata."""
        try:
            # Get the points (documents) from the collection
            points = self.client.scroll(
                collection_name=self.collection_name,
                limit=limit,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )[0]  # The scroll method returns a tuple (points, next_page_offset)
            
            # Format the results
            documents = []
            for point in points:
                doc_id = point.id
                payload = point.payload
                
                # We need to return the full payload for the frontend to properly display documents
                documents.append({
                    "id": doc_id,
                    "payload": payload
                })
            
            logger.info(f"Retrieved {len(documents)} documents from collection")
            return documents
        except Exception as e:
            logger.error(f"Error listing documents: {str(e)}")
            return []
    
    def delete_document(self, doc_id):
        """Delete a document from the collection by ID."""
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.PointIdsList(points=[doc_id])
            )
            logger.info(f"Deleted document with ID {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting document with ID {doc_id}: {str(e)}")
            return False
    
    def delete_all_documents(self):
        """Delete all documents from the collection."""
        try:
            # Filter that matches all points in the collection
            filter_all = models.Filter(must=[])
            
            # Delete all points matching the filter (all points)
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(filter=filter_all)
            )
            logger.info(f"Deleted all documents from collection {self.collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error deleting all documents: {str(e)}")
            return False
            
    def get_collection_stats(self):
        """Get statistics about the collection."""
        try:
            # Get the collection info
            collection_info = self.client.get_collection(self.collection_name)
            
            # Get the count of vectors/points in the collection
            count_result = self.client.count(collection_name=self.collection_name)
            
            # Safe extraction of vector size
            vector_size = VECTOR_SIZE  # Default size from config
            vector_distance = "cosine"  # Default distance
            
            # Only try to access these properties if they exist
            try:
                if hasattr(collection_info, 'config') and hasattr(collection_info.config, 'params'):
                    if hasattr(collection_info.config.params, 'vectors'):
                        # For dictionary-like objects
                        if isinstance(collection_info.config.params.vectors, dict):
                            vector_size = collection_info.config.params.vectors.get('size', vector_size)
                            vector_distance = collection_info.config.params.vectors.get('distance', vector_distance)
                        # For object-like with attributes
                        elif hasattr(collection_info.config.params.vectors, 'size'):
                            vector_size = collection_info.config.params.vectors.size
                            if hasattr(collection_info.config.params.vectors, 'distance'):
                                vector_distance = str(collection_info.config.params.vectors.distance)
            except AttributeError:
                logger.warning("Could not access vector configuration details, using defaults")
            
            stats = {
                "name": self.collection_name,
                "vectors_count": getattr(count_result, 'count', 0),
                "status": getattr(collection_info, 'status', 'unknown'),
                "vector_size": vector_size,
                "distance": vector_distance,
            }
            
            return stats
        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            return {
                "name": self.collection_name,
                "vectors_count": 0,
                "status": "error",
                "vector_size": VECTOR_SIZE,
                "distance": "cosine",
                "error": str(e)
            }