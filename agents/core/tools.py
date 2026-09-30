import logging

from crewai.tools import tool
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

@tool("Internet Search Tool")
def internet_search_tool(query: str) -> str:
    """
    Useful for searching the internet for current events, market data, competitors,
    and pricing models.
    Input should be a highly specific search query string.
    Returns a string containing relevant text snippets from the web.
    """
    try:
        # Initialize the DuckDuckGo searcher natively
        with DDGS() as ddgs:
            # Fetch the top 5 text results
            results = ddgs.text(query, max_results=5)

            # Format the results into a readable string for the agent
            formatted_results: list[str] = []
            for r in results:
                formatted_results.append(f"Title: {r['title']}\nSnippet: {r['body']}\nLink: {r['href']}\n")

            return "\n".join(formatted_results)

    except Exception:
        # Log the real reason server-side; never surface internals to the LLM.
        logger.exception("Internet search failed for query %r", query)
        return "Error: Search failed, please try a different query."