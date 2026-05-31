import sys
sys.path.insert(0, '.')
from main import full_bypass

url = 'https://tpi.li/iE62R0l6m'
print('Testing:', url)
try:
    result = full_bypass(url)
    print('RESULT:', result)
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
