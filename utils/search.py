import logging
import requests
from config import SERPER_API_KEY

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def search_web(query, num_results=3):
    """
    Search the web using Serper API.
    
    Args:
        query (str): The search query
        num_results (int, optional): Number of results to return. Defaults to 3.
    
    Returns:
        list: List of search results as formatted strings
    """
    try:
        headers = {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json'
        }
        
        payload = {
            'q': query,
            'num': num_results
        }
        
        response = requests.post('https://google.serper.dev/search', headers=headers, json=payload)
        
        if response.status_code != 200:
            logger.error(f"Error from Serper API: {response.status_code} {response.text}")
            return [f"Search failed with status code {response.status_code}"]
        
        results = response.json()
        
        # Process and format the results
        formatted_results = []
        
        # Process organic results
        if 'organic' in results:
            for item in results['organic'][:num_results]:
                title = item.get('title', 'No title')
                snippet = item.get('snippet', 'No description')
                link = item.get('link', 'No link')
                
                formatted_result = f"{title}\n{snippet}\n[Source: {link}]"
                formatted_results.append(formatted_result)
        
        # If we didn't get enough results, check for other types
        if len(formatted_results) < num_results and 'knowledge_graph' in results:
            kg = results['knowledge_graph']
            title = kg.get('title', 'Knowledge Graph')
            description = kg.get('description', 'No description')
            
            formatted_result = f"{title}\n{description}\n[Source: Knowledge Graph]"
            formatted_results.append(formatted_result)
        
        # Return the formatted results or a default message
        return formatted_results if formatted_results else ["No search results found"]
    
    except Exception as e:
        logger.error(f"Error during web search: {str(e)}")
        return [f"Search failed with error: {str(e)}"]