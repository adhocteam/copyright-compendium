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

    it('should support window.Translator (Chrome 141+)', async () => {
      const capabilitiesMock = {
        available: 'readily',
        languagePairAvailable: vi.fn().mockReturnValue('readily')
      };
      (window as any).Translator = {
        capabilities: vi.fn().mockResolvedValue(capabilitiesMock),
        create: vi.fn()
      };

      service = new TranslationService();
      const supported = await service.checkBrowserSupport();

      expect(supported).toBe(true);
      expect((window as any).Translator.capabilities).toHaveBeenCalled();
      expect(capabilitiesMock.languagePairAvailable).toHaveBeenCalledWith('en', 'es');
    });

    it('should fallback to window.Translator.availability (older spec shim)', async () => {
      (window as any).Translator = {
        availability: vi.fn().mockResolvedValue('available'),
        create: vi.fn()
      };

      service = new TranslationService();
      const supported = await service.checkBrowserSupport();

      expect(supported).toBe(true);
      expect((window as any).Translator.availability).toHaveBeenCalled();
    });


    // We want to verify that we prefer Translator over ai.translator
    it('should prefer window.Translator over window.ai.translator', async () => {
      // Mock both
      (window as any).Translator = {
        capabilities: vi.fn().mockResolvedValue({
          languagePairAvailable: () => 'readily'
        }),
        create: vi.fn()
      };
      (window as any).ai = {
        translator: {
          capabilities: vi.fn()
        }
      };

      service = new TranslationService();
      await service.checkBrowserSupport();

      expect((window as any).Translator.capabilities).toHaveBeenCalled();
      expect((window as any).ai.translator.capabilities).not.toHaveBeenCalled();
    });

    it('should fallback to window.ai.translator if window.Translator is missing', async () => {
      const capabilitiesMock = {
        languagePairAvailable: vi.fn().mockReturnValue('readily')
      };
      (window as any).ai = {
        translator: {
          capabilities: vi.fn().mockResolvedValue(capabilitiesMock),
          create: vi.fn()
        }
      };
      // Ensure Translator is undefined
      (window as any).Translator = undefined;

      service = new TranslationService();
      const supported = await service.checkBrowserSupport();

      expect(supported).toBe(true);
      expect((window as any).ai.translator.capabilities).toHaveBeenCalled();
    });
  });

  describe('Translation Logic', () => {
    it('should create translator using window.Translator when available', async () => {
      const createMock = vi.fn().mockResolvedValue({
        translate: vi.fn().mockResolvedValue('Hola Mundo')
      });

      (window as any).Translator = {
        create: createMock,
        capabilities: vi.fn().mockResolvedValue({
          languagePairAvailable: () => 'readily'
        })
      };

      service = new TranslationService();
      await service.checkBrowserSupport(); // Ensure flag is true

      const element = document.createElement('div');
      element.innerHTML = '<p>Hello World</p>';

      const success = await service.translateContent(element, 'es');

      expect(success).toBe(true);
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'es'
      }));
    });

    it('should fallback to creating translator using window.ai.translator', async () => {
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
      (window as any).Translator = undefined;

      service = new TranslationService();
      await service.checkBrowserSupport();

      const element = document.createElement('div');
      element.innerHTML = '<p>Hello World</p>';

      const success = await service.translateContent(element, 'es');

      expect(success).toBe(true);
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
        sourceLanguage: 'en',
        targetLanguage: 'es'
      }));
    });

    it('should gracefully handle translation errors', async () => {
      (window as any).Translator = {
        create: vi.fn().mockRejectedValue(new Error('Model download failed'))
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
