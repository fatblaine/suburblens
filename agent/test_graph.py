from dotenv import load_dotenv
load_dotenv()

from graph import graph
from langchain_core.messages import HumanMessage


config = {"configurable": {"thread_id": "test-1"}}

result = graph.invoke(
    {"messages": [HumanMessage(content="Glebe 这个郊区的教育水平怎么样？")]},
    config,
)

print(result["messages"][-1].content)
