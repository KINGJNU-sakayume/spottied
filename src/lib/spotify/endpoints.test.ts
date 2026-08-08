import { describe, expect, it } from 'vitest';
import {
  CATALOG_MARKET,
  SEARCH_PAGE_SIZE,
  buildArtistSearchPath,
} from './endpoints';

describe('buildArtistSearchPath', () => {
  it('stays within the February 2026 limit ceiling of 10', () => {
    expect(SEARCH_PAGE_SIZE).toBeLessThanOrEqual(10);
    const params = new URLSearchParams(
      buildArtistSearchPath('aespa').split('?')[1],
    );
    expect(Number(params.get('limit'))).toBeLessThanOrEqual(10);
  });

  it('builds the full search query', () => {
    const params = new URLSearchParams(
      buildArtistSearchPath('aespa').split('?')[1],
    );
    expect(params.get('q')).toBe('aespa');
    expect(params.get('type')).toBe('artist');
    expect(params.get('market')).toBe(CATALOG_MARKET);
    expect(params.get('offset')).toBe('0');
  });

  it('percent-encodes non-ASCII queries', () => {
    expect(buildArtistSearchPath('검정치마')).toContain(
      'q=%EA%B2%80%EC%A0%95%EC%B9%98%EB%A7%88',
    );
  });

  it('pages with offset', () => {
    const params = new URLSearchParams(
      buildArtistSearchPath('aespa', 20).split('?')[1],
    );
    expect(params.get('offset')).toBe('20');
  });
});
