import os
import logging
from werkzeug.utils import secure_filename
from config import UPLOAD_FOLDER, ALLOWED_EXTENSIONS
import trafilatura
import PyPDF2
from youtube_transcript_api import YouTubeTranscriptApi

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def allowed_file(filename, file_type=None):
    """
    Check if a file has an allowed extension.
    
    Args:
        filename (str): The filename to check
        file_type (str, optional): The specific file type to check against. 
                                 If None, checks against all allowed extensions.
    
    Returns:
        bool: True if the file is allowed, False otherwise
    """
    if '.' not in filename:
        return False
    
    ext = filename.rsplit('.', 1)[1].lower()
    
    if file_type:
        return ext in ALLOWED_EXTENSIONS and ext == file_type
    else:
        return ext in ALLOWED_EXTENSIONS

def extract_text_from_file(file):
    """Extract text from a plain text file."""
    try:
        content = file.read()
        # Try to decode if it's bytes
        if isinstance(content, bytes):
            try:
                content = content.decode('utf-8')
            except UnicodeDecodeError:
                content = content.decode('utf-8', errors='replace')
        return content
    except Exception as e:
        logger.error(f"Error extracting text from file: {str(e)}")
        raise

def extract_text_from_pdf(file):
    """Extract text from a PDF file."""
    try:
        # Save the file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Extract text from PDF
        text = ""
        try:
            with open(filepath, 'rb') as pdf_file:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text += page.extract_text() + "\n"
        finally:
            # Clean up the temporary file
            if os.path.exists(filepath):
                os.remove(filepath)
        
        return text if text.strip() else "No text could be extracted from the PDF"
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        raise

def extract_text_from_youtube(url):
    """Extract transcript from a YouTube video."""
    try:
        # Extract video ID from URL
        if 'youtu.be' in url:
            video_id = url.split('/')[-1].split('?')[0]
        elif 'youtube.com/watch' in url:
            video_id = url.split('v=')[1].split('&')[0]
        else:
            return "Invalid YouTube URL format. Please provide a valid YouTube URL."
        
        # Get the transcript
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        
        # Combine all text entries from the transcript
        transcript_text = ' '.join([entry['text'] for entry in transcript])
        
        return transcript_text
    except Exception as e:
        logger.error(f"Error extracting text from YouTube: {str(e)}")
        return f"Failed to extract transcript: {str(e)}"

def extract_text_from_audio(file):
    """
    Extract text from an audio file using Gemini API.
    
    Args:
        file: The audio file object
        
    Returns:
        str: The transcribed text
    """
    import os
    import tempfile
    import requests
    import json
    from config import GOOGLE_API_KEY
    
    try:
        # Save the file temporarily
        filename = secure_filename(file.filename)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            file.save(temp_file.name)
            audio_path = temp_file.name
        
        try:
            # Get MIME type
            import mimetypes
            mime_type = mimetypes.guess_type(filename)[0] or 'audio/mp3'
            
            # Get file size
            file_size = os.path.getsize(audio_path)
            
            # Step 1: Upload the file
            headers = {
                "X-Goog-Upload-Protocol": "resumable",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Header-Content-Length": str(file_size),
                "X-Goog-Upload-Header-Content-Type": mime_type,
                "Content-Type": "application/json"
            }
            
            upload_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={GOOGLE_API_KEY}"
            display_name = os.path.basename(audio_path)
            
            # Make the initial resumable request
            response = requests.post(
                upload_url,
                headers=headers,
                data=json.dumps({"file": {"display_name": display_name}})
            )
            
            if response.status_code != 200:
                raise Exception(f"Initial upload request failed: {response.status_code}, {response.text}")
            
            # Get the upload URL from response headers
            upload_url = response.headers.get("X-Goog-Upload-URL")
            if not upload_url:
                raise Exception("Failed to get upload URL")
            
            # Step 2: Upload the actual file bytes
            with open(audio_path, 'rb') as f:
                file_data = f.read()
                
            headers = {
                "Content-Length": str(file_size),
                "X-Goog-Upload-Offset": "0",
                "X-Goog-Upload-Command": "upload, finalize"
            }
            
            response = requests.post(upload_url, headers=headers, data=file_data)
            
            if response.status_code != 200:
                raise Exception(f"File upload failed: {response.status_code}, {response.text}")
            
            file_info = response.json()
            file_uri = file_info.get("file", {}).get("uri")
            
            if not file_uri:
                raise Exception("Failed to get file URI")
            
            # Step 3: Generate content using the file
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GOOGLE_API_KEY}"
            
            headers = {'Content-Type': 'application/json'}
            
            payload = {
                "contents": [{
                    "parts":[
                        {"text": "Transcribe this audio clip accurately"},
                        {"file_data": {"mime_type": mime_type, "file_uri": file_uri}}
                    ]
                }]
            }
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code != 200:
                raise Exception(f"Transcription failed: {response.status_code}, {response.text}")
            
            # Extract the transcription from the response
            result = response.json()
            if "candidates" in result and len(result["candidates"]) > 0:
                parts = result["candidates"][0]["content"]["parts"]
                transcription = " ".join([part.get("text", "") for part in parts if "text" in part])
                return transcription
            else:
                raise Exception("No transcription found in the response")
            
        finally:
            # Clean up the temporary file
            if os.path.exists(audio_path):
                os.remove(audio_path)
                
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        return f"Failed to transcribe audio: {str(e)}"

def extract_text_from_image(file):
    """
    Extract text from an image using Gemini Vision.
    
    Args:
        file: The image file object
        
    Returns:
        str: The extracted text
    """
    import os
    import tempfile
    import base64
    import requests
    import json
    from config import GOOGLE_API_KEY
    
    try:
        # Save the file temporarily
        filename = secure_filename(file.filename)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            file.save(temp_file.name)
            image_path = temp_file.name
        
        try:
            # Get MIME type
            import mimetypes
            mime_type = mimetypes.guess_type(filename)[0] or 'image/jpeg'
            
            # Read the file and encode as base64
            with open(image_path, "rb") as img_file:
                base64_image = base64.b64encode(img_file.read()).decode("utf-8")
            
            # Call Gemini API
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GOOGLE_API_KEY}"
            
            headers = {'Content-Type': 'application/json'}
            
            payload = {
                "contents": [{
                    "parts":[
                        {"text": "Extract and transcribe all visible text from this image"},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64_image
                            }
                        }
                    ]
                }]
            }
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code != 200:
                raise Exception(f"Image text extraction failed: {response.status_code}, {response.text}")
            
            # Extract the extracted text from the response
            result = response.json()
            if "candidates" in result and len(result["candidates"]) > 0:
                parts = result["candidates"][0]["content"]["parts"]
                extracted_text = " ".join([part.get("text", "") for part in parts if "text" in part])
                return extracted_text
            else:
                raise Exception("No text extraction found in the response")
            
        finally:
            # Clean up the temporary file
            if os.path.exists(image_path):
                os.remove(image_path)
                
    except Exception as e:
        logger.error(f"Error extracting text from image: {str(e)}")
        return f"Failed to extract text from image: {str(e)}"

def extract_text_from_website(url):
    """Extract text from a website."""
    try:
        # Download the web page
        downloaded = trafilatura.fetch_url(url)
        
        # Extract the main text content
        text = trafilatura.extract(downloaded)
        
        if not text:
            return f"Could not extract text from {url}. The website might block scraping or contain no text content."
        
        return text
    except Exception as e:
        logger.error(f"Error extracting text from website: {str(e)}")
        return f"Failed to extract text from website: {str(e)}"