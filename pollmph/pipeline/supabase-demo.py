import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# # read outputs.json as dictionary
# with open("outputs.json", "r", encoding="utf-8") as f:
#     outputs = json.load(f)

# output_dict = [json.loads(output) for output in outputs]

# try:
#     response = supabase.table("sentiments").insert(output_dict).execute()
#     print(response)
# except Exception as e:
#     print(f"Failed to insert sentiments: {e}")


response = supabase.table("sentiments").select("*").execute()

print(response.data)
