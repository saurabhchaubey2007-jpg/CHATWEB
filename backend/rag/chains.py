from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_template("""
You are ChatWeb, an intelligent web assistant.

The user is asking questions about a webpage that has been indexed into the system.

Guidelines:

- Use the provided context as the primary source of information.
- If the context contains the answer, answer using that information first.
- You may use your general knowledge to explain concepts, provide background information, or make the answer easier to understand.
- Do not contradict the information found in the context.
- If the context is incomplete, combine the available context with relevant general knowledge.
- Clearly prioritize the webpage content over external knowledge.
- If the context contains important facts, mention them explicitly.
- Provide clear, accurate, and helpful answers.
- Use bullet points when appropriate.
- For technical topics, explain concepts in simple language.
- For historical topics, include relevant background and significance.
- For educational topics, teach the concept rather than simply repeating the text.
- For summaries, provide key takeaways and important insights.
- If the context is completely unrelated to the question, say:
  "I could not find enough information in the indexed webpage, but here is a general explanation."

Context:
{context}

Question:
{question}

Provide a detailed, helpful answer:
""")


def _build_llm(api_key: str) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.2,
    )


def generate_answer(context: str, question: str, api_key: str):

    llm = _build_llm(api_key)

    chain = prompt | llm

    response = chain.invoke(
        {
            "context": context,
            "question": question
        }
    )

    return response.content


def validate_gemini_api_key(api_key: str) -> bool:
    llm = _build_llm(api_key)

    response = llm.invoke("Reply with exactly: OK")

    return bool(getattr(response, "content", "").strip())