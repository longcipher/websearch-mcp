export class WebSearchError extends Error {
  readonly code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebSearchError';
    this.code = code;
  }
}

export class ConfigurationError extends WebSearchError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'CONFIGURATION_ERROR', options);
    this.name = 'ConfigurationError';
  }
}

export class ProviderError extends WebSearchError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'PROVIDER_ERROR', options);
    this.name = 'ProviderError';
  }
}

export class TimeoutError extends WebSearchError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'TIMEOUT_ERROR', options);
    this.name = 'TimeoutError';
  }
}

export class UnsupportedContentError extends WebSearchError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'UNSUPPORTED_CONTENT', options);
    this.name = 'UnsupportedContentError';
  }
}

export class AntiBotBlockError extends WebSearchError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'ANTI_BOT_BLOCK', options);
    this.name = 'AntiBotBlockError';
  }
}

export class SecurityBlockError extends WebSearchError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'SECURITY_BLOCK', options);
    this.name = 'SecurityBlockError';
  }
}

export class ParseError extends WebSearchError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'PARSE_ERROR', options);
    this.name = 'ParseError';
  }
}
