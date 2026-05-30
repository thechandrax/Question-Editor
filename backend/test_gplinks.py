import sys
sys.path.insert(0, '.')
from main import full_bypass

url = 'https://gplinks.co/XZzPN59e'
print('Testing:', url)
try:
    result = full_bypass(url)
    print('RESULT:', result)
except Exception as e:
    print('ERROR:', e)
