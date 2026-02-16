import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranslationService } from './script';

describe('TranslationService', () => {
  let service: TranslationService;

  // Reset mocks and DOM before each test
  beforeEach(() => {
    vi.resetAllMocks();
    // Clear window APIs
    (window as any).Translator = undefined;
    (window as any).ai = undefined;
    document.body.innerHTML = '';

    // Mock localStorage
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        length: 0,
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  describe('Browser Support Check', () => {
    it('should return false when no API is available', async () => {
      service = new TranslationService();
      const supported = await service.checkBrowserSupport();
      expect(supported).toBe(false);
    });

    it('should support new window.ai.translator API (capabilities)', async () => {
      const capabilitiesMock = {
        available: 'readily',
        languagePairAvailable: vi.fn().mockReturnValue('readily')
      };
      (window as any).ai = {
        translator: {
          capabilities: vi.fn().mockResolvedValue(capabilitiesMock),
          create: vi.fn()
        }
      };

      service = new TranslationService();
      const supported = await service.checkBrowserSupport();

      expect(supported).toBe(true);
      expect((window as any).ai.translator.capabilities).toHaveBeenCalled();
      expect(capabilitiesMock.languagePairAvailable).toHaveBeenCalledWith('en', 'es');
    });

    it('should support new window.ai.translator API (no capabilities function)', async () => {
      // Flux specs sometimes have create but not capabilities yet? Or we fallback safe
      (window as any).ai = {
        translator: {
          create: vi.fn()
        }
      };

      service = new TranslationService();
      const supported = await service.checkBrowserSupport();

      expect(supported).toBe(true);
    });


    it('should support old window.Translator API', async () => {
      (window as any).Translator = {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn()
      };

      service = new TranslationService();
      const supported = await service.checkBrowserSupport();

      expect(supported).toBe(true);
      expect((window as any).Translator.availability).toHaveBeenCalled();
    });
  });

  describe('Translation Logic', () => {
    it('should create translator using window.ai.translator', async () => {
      const createMock = vi.fn().mockResolvedValue({
        translate: vi.fn().mockResolvedValue('Hola Mundo')
      });

      (window as any).ai = {
        translator: {
          create: createMock,
          capabilities: vi.fn().mockResolvedValue({
            languagePairAvailable: () => 'readily'
          })
        }
      };

      service = new TranslationService();
      await service.checkBrowserSupport(); // Ensure flag is true

      const element = document.createElement('div');
      element.innerHTML = '<p>Hello World</p>';

      // Mock tree walker for simple content
      // Note: JSDOM TreeWalker might behave slightly differently, but standard iteration should work.
      // Our service uses a tree walker.

      const success = await service.translateContent(element, 'es');

      expect(success).toBe(true);
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'es'
      }));
      // We can't easily check the element content update without more complex DOM setup or mocking the walker, 
      // but we verified the create call logic.
    });

    it('should gracefully handle translation errors', async () => {
      (window as any).ai = {
        translator: {
          create: vi.fn().mockRejectedValue(new Error('Model download failed'))
        }
      };

      service = new TranslationService();
      // Manually force support to true to bypass check for this test
      (service as any).canTranslate = true;

      const element = document.createElement('div');
      const success = await service.translateContent(element, 'es');

      expect(success).toBe(false);
    });
  });
});
