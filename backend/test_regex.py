import re

tests = [
    "$1.$ Hello",
    r"\(1.\) Hello",
    "$(A)$ Option",
    r"\((a)\) Option",
    "Correct: Option $(B)$",
    r"Correct: Option \((b)\)"
]

print("--- Question Regex ---")
regex_q = r'^(?:\$|\\\()(\d+)\.(?:\$|\\\))\s*(.*)'
for t in tests:
    m = re.match(regex_q, t)
    if m:
        print(f"Match Q '{t}': {m.groups()}")

print("\n--- Option Regex ---")
regex_opt = r'^(?:\$|\\\()\(([a-d])\)(?:\$|\\\))\s*(.*)'
for t in tests:
    m = re.match(regex_opt, t, re.IGNORECASE)
    if m:
        print(f"Match Opt '{t}': {m.groups()}")
        
print("\n--- Correct Answer Regex ---")
regex_ans = r'^Correct:\s*Option\s*(?:\$|\\\()\(([a-d])\)(?:\$|\\\))'
for t in tests:
    m = re.match(regex_ans, t, re.IGNORECASE)
    if m:
        print(f"Match Ans '{t}': {m.groups()}")
