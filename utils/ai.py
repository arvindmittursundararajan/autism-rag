import logging
import requests
import json
import os
from config import GOOGLE_API_KEY

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load prompt templates
def load_prompt_template(template_name):
    """Load a prompt template from the prompts directory."""
    try:
        template_path = os.path.join('prompts', f'{template_name}.txt')
        if os.path.exists(template_path):
            with open(template_path, 'r') as file:
                return file.read()
        else:
            logger.warning(f"Prompt template {template_name}.txt not found")
            return None
    except Exception as e:
        logger.error(f"Error loading prompt template: {str(e)}")
        return None

def generate_title_for_content(content):
    """
    Generate a title for the given content using Gemini API.
    
    Args:
        content (str): The content to generate a title for
        
    Returns:
        str: The generated title
    """
    try:
        # Limit content to first 300 characters to keep prompt small
        content_preview = content[:300] + "..." if len(content) > 300 else content
        
        # Create the prompt
        prompt = f"""
        Generate a concise, descriptive title for the following content. 
        The title should be 5-10 words and accurately reflect the main topic.
        
        Content: {content_preview}
        
        Title:
        """
        
        # Define the API endpoint
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        
        # Prepare the request payload
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        # Make the POST request
        response = requests.post(url, params={'key': GOOGLE_API_KEY}, json=payload)
        
        # Check for successful response
        if response.status_code == 200:
            title = response.json().get('contents', [{}])[0].get('parts', [{}])[0].get('text', '').strip()
            
            # If title is too long, truncate it
            if len(title) > 100:
                title = title[:97] + "..."
                
            return title
        else:
            logger.error(f"Error generating title: {response.text}")
            return "Untitled Document"
    
    except Exception as e:
        logger.error(f"Error generating title: {str(e)}")
        return "Untitled Document"

def generate_ai_response(user_query, knowledge_results=None, web_results=None):
    """
    Generate an AI response using Gemini API, incorporating knowledge base and web search results.
    
    Args:
        user_query (str): The user's question
        knowledge_results (list, optional): Results from the knowledge base. Defaults to None.
        web_results (list, optional): Results from web search. Defaults to None.
    
    Returns:
        dict: Dictionary containing the AI response and citations
    """
    try:
        # Prepare context from knowledge base and web search results
        context_parts = []
        citations = []
        
        # Add knowledge base results to context
        if knowledge_results and len(knowledge_results) > 0:
            context_parts.append("Information from Knowledge Base:")
            for i, result in enumerate(knowledge_results):
                context_parts.append(f"[KB{i+1}]: {result}")
                citations.append({
                    "id": f"KB{i+1}",
                    "text": result[:150] + "..." if len(result) > 150 else result,
                    "source": "Knowledge Base"
                })
        
        # Add web search results to context
        if web_results and len(web_results) > 0:
            context_parts.append("Information from Web Search:")
            for i, result in enumerate(web_results):
                context_parts.append(f"[WEB{i+1}]: {result}")
                # Extract source information for citation
                source_start = result.rfind("[Source: ")
                source_text = result[source_start:] if source_start > -1 else "[Source: Web]"
                citations.append({
                    "id": f"WEB{i+1}",
                    "text": result[:150] + "..." if len(result) > 150 else result,
                    "source": source_text
                })
        
        # Prepare the prompt for Gemini
        context_text = '\n'.join(context_parts) if context_parts else 'No additional context provided.'
        
        # Load the chat response template
        template = load_prompt_template('chat_response')
        if template:
            instructions = template
        else:
            # Fallback to hardcoded instructions if template isn't found
            instructions = """
            Instructions:
            1. Answer the user's query based on the provided information and your knowledge
            2. If the context information is relevant, incorporate it and cite the source using the format [KB1], [WEB1], etc.
            3. If you don't have relevant information, just answer to the best of your ability
            4. Be concise and clear in your response
            5. Format the answer in a way that's easy to read
            6. Do not include timestamps or date information in your responses
            """
            
        prompt = f"""
        User Query: {user_query}
        
        {context_text}
        
        {instructions}
        """
        
        # Define the API endpoint
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        
        # Prepare the request payload
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        # Make the POST request
        response = requests.post(url, params={'key': GOOGLE_API_KEY}, json=payload)
        
        # Check for successful response
        if response.status_code == 200:
            response_text = response.json().get('contents', [{}])[0].get('parts', [{}])[0].get('text', 'I couldn\'t generate a response. Please try again.')
        else:
            logger.error(f"Error generating AI response: {response.text}")
            response_text = "I couldn't generate a response. Please try again."
        
        return {
            "response": response_text,
            "citations": citations
        }
    
    except Exception as e:
        logger.error(f"Error generating AI response: {str(e)}")
        error_msg = f"I encountered an error while processing your request. Please try again. Error details: {str(e)}"
        return {
            "response": error_msg,
            "citations": []
        }
