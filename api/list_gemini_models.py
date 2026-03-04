import os
import google.generativeai as genai

api_key = os.getenv("LLM_API_KEY")
if not api_key:
    print("Please set LLM_API_KEY environment variable")
    exit(1)
genai.configure(api_key=api_key)

print("Available models:")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
