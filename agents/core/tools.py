import logging

from crewai.tools import tool

try:  # duckduckgo_search was renamed to ddgs; prefer the maintained package.
    from ddgs import DDGS
    from ddgs.exceptions import DDGSException, RatelimitException, TimeoutException
except ImportError:  # pragma: no cover - only for installs still on the old name
    from duckduckgo_search import DDGS

    class DDGSException(Exception):
        """Stand-in so the handling below stays reachable on the old package."""

    class RatelimitException(DDGSException):
        """Stand-in so the handling below stays reachable on the old package."""

    class TimeoutException(DDGSException):
        """Stand-in so the handling below stays reachable on the old package."""

logger = logging.getLogger(__name__)

_MAX_RESULTS = 5

# The search backend fails in two shapes and neither reaches the except branch
# the tool used to have. duckduckgo_search returned an empty list without
# raising, which read to the agent as "the web has nothing on this technology";
# ddgs 9 raises DDGSException("No results found.") instead. Both count as "this
# backend had nothing", and "lite" is retried because it is a different endpoint
# than the default one - a query the primary backend is throttled on usually
# still answers there.
_SEARCH_BACKENDS = ("auto", "lite")

_SEARCH_FAILED_NOTE = (
    "Error: Search failed or returned no results. Please try a different query."
)


@tool("Internet Search Tool")
def internet_search_tool(query: str) -> str:
    """
    Useful for searching the internet for current events, market data, competitors,
    and pricing models.
    Input should be a highly specific search query string.
    Returns a string containing relevant text snippets from the web.
    """
    for backend in _SEARCH_BACKENDS:
        try:
            # Initialize the DuckDuckGo searcher natively
            with DDGS(timeout=10) as ddgs:
                # Fetch the top 5 text results
                results = ddgs.text(query, max_results=_MAX_RESULTS, backend=backend)
        except (RatelimitException, TimeoutException) as error:
            logger.warning(
                "Internet search (%s backend) was throttled for query %r: %s",
                backend,
                query,
                error,
            )
            continue
        except DDGSException as error:
            logger.info(
                "Internet search (%s backend) found nothing for query %r: %s",
                backend,
                query,
                error,
            )
            continue
        except Exception:
            # Log the real reason server-side; never surface internals to the LLM.
            logger.exception("Internet search (%s backend) failed for query %r", backend, query)
            continue

        if not results:
            logger.warning(
                "Internet search (%s backend) returned no results for query %r",
                backend,
                query,
            )
            continue

        # Format the results into a readable string for the agent
        formatted_results: list[str] = []
        for r in results:
            formatted_results.append(
                f"Title: {r.get('title', '')}\n"
                f"Snippet: {r.get('body', '')}\n"
                f"Link: {r.get('href', '')}\n"
            )

        return "\n".join(formatted_results)

    return _SEARCH_FAILED_NOTE
