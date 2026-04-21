import re
import uuid
from bs4 import BeautifulSoup

with open('index.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f.read(), 'html.parser')

target_tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'span', 'strong', 'b', 'i']

count = 0
for tag in soup.find_all(target_tags):
    # Only tag that actually has useful direct text
    text_content = tag.find(text=True, recursive=False)
    if text_content and text_content.strip() and not tag.has_attr('data-edit-id'):
        tag['data-edit-id'] = f"auto-{uuid.uuid4().hex[:8]}"
        count += 1

# write to test.html
with open('test.html', 'w', encoding='utf-8') as f:
    f.write(str(soup))
print(f"Injected {count} IDs")
