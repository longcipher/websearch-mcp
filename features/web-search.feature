Feature: Web Search MCP Tools
  As an MCP client
  I want to use web_search and web_fetch tools
  So that I can search the web and extract content

  Scenario: web_fetch returns structured content from a local test page
    Given the web search MCP server is running
    When I call the "web_fetch" tool with url "https://example.com"
    Then the response should have "fetch_status" set to "ok"
    And the response should have a non-empty "content" field
    And the "content_length" should be greater than 0

  Scenario: web_fetch extracts markdown from HTML
    Given the web search MCP server is running
    When I call the "web_fetch" tool with url "https://example.com"
    Then the response should have "content_kind" set to "generic_html"
    And the response should have a non-empty "content" field

  Scenario: web_fetch returns deterministic note on failure
    Given the web search MCP server is running
    When I call the "web_fetch" tool with url "https://nonexistent.invalid"
    Then the response should have "fetch_status" set to "error"
    And the "content" should contain a failure description

  Scenario: get_content is a backward-compatible alias for web_fetch
    Given the web search MCP server is running
    When I call the "get_content" tool with url "https://example.com"
    Then the response should have the same shape as "web_fetch"
