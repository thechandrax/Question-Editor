import re

with open('src/components/BulkEditor.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def check_blocks(start, end):
    stack = []
    in_string = False
    string_char = ''
    in_comment = False
    for i in range(start, end):
        line = lines[i]
        j = 0
        while j < len(line):
            char = line[j]
            if not in_string and not in_comment:
                if char == '{':
                    stack.append(i+1)
                elif char == '}':
                    if stack:
                        stack.pop()
                    else:
                        print(f'Unexpected }} at line {i+1}')
                elif char in ("'", '"', '`'):
                    in_string = True
                    string_char = char
                elif char == '/' and j+1 < len(line) and line[j+1] == '/':
                    break # line comment
                elif char == '/' and j+1 < len(line) and line[j+1] == '*':
                    in_comment = True
                    j += 1
            elif in_string:
                if char == '\\':
                    j += 1
                elif char == string_char:
                    in_string = False
            elif in_comment:
                if char == '*' and j+1 < len(line) and line[j+1] == '/':
                    in_comment = False
                    j += 1
            j += 1
    
    if stack:
        print('Unclosed { opened at lines:', stack)

check_blocks(186, 619)
