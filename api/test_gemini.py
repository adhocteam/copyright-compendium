import os
import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

async def test_summary():
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        print("Please set LLM_API_KEY environment variable")
        return
    os.environ["GOOGLE_API_KEY"] = api_key
    
    print("Initializing Gemini...")
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", google_api_key=api_key)
    
    context = "Section 101 of the Copyright Act. Copyright protection subsists, in accordance with this title, in original works of authorship fixed in any tangible medium of expression, now known or later developed, from which they can be perceived, reproduced, or otherwise communicated, either directly or with the aid of a machine or device."
    query = "What is copyright protection?"
    
    prompt = f"Context:\n{context}\n\nQuestion: {query}\n\nPlease summarize the context to answer the question briefly."
    
    print(f"Sending prompt to Gemini 1.5 Pro:\n{prompt}")
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        print("\n=== Gemini Response ===")
        print(response.content)
        print("========================\n")
        print("Test passed successfully!")
    except Exception as e:
        print(f"Error testing Gemini: {e}")

if __name__ == "__main__":
    asyncio.run(test_summary())
