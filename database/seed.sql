-- Seed 15 Python Control Flow questions (5 easy, 7 medium, 3 hard)
INSERT INTO questions (concept_type, difficulty, code_snippet, option_1, option_2, option_3, correct_option_index, explanation)
VALUES
-- Easy (5 questions)
('if/else', 'easy', 'x = 10
if x > 5:
    print("A")
else:
    print("B")', 'A', 'B', 'Error', 1, 'Since x is 10, the condition x > 5 evaluates to True, so "A" is printed.'),

('for loops', 'easy', 'total = 0
for i in [1, 2, 3]:
    total += i
print(total)', '5', '6', '3', 2, 'The loop iterates over 1, 2, and 3. Adding them together gives 0 + 1 + 2 + 3 = 6.'),

('while loops', 'easy', 'count = 3
while count > 0:
    count -= 1
print(count)', '1', '0', '-1', 2, 'The while loop decrements count until count is no longer greater than 0. The final value when the loop terminates is 0.'),

('range()', 'easy', 'nums = list(range(2, 6))
print(len(nums))', '4', '5', '3', 1, 'range(2, 6) generates integers from 2 up to, but not including, 6: [2, 3, 4, 5], which contains 4 elements.'),

('if/else', 'easy', 'num = 7
if num % 2 == 0:
    res = "Even"
else:
    res = "Odd"
print(res)', 'Even', 'Odd', '7', 2, '7 % 2 is 1, which is not equal to 0. Thus, the else branch executes, assigning "Odd" to res.'),

-- Medium (7 questions)
('break', 'medium', 'for x in range(1, 10):
    if x == 4:
        break
print(x)', '3', '4', '9', 2, 'When x reaches 4, the condition x == 4 is met and the break statement immediately terminates the loop. The variable x remains 4.'),

('continue', 'medium', 'out = []
for i in range(5):
    if i % 2 == 0:
        continue
    out.append(i)
print(out)', '[1, 3]', '[0, 2, 4]', '[1, 2, 3, 4]', 1, 'The continue statement skips even numbers (0, 2, 4). Only odd numbers (1, 3) are appended to out.'),

('range()', 'medium', 's = 0
for i in range(10, 0, -3):
    s += 1
print(s)', '3', '4', '10', 2, 'range(10, 0, -3) generates values 10, 7, 4, 1. The loop runs 4 times, so s increments 4 times.'),

('while loops', 'medium', 'i = 1
while i < 10:
    i *= 2
print(i)', '8', '16', '10', 2, 'i takes values 1, 2, 4, 8. When i is 8, the condition 8 < 10 is true, so i multiplies by 2 to become 16. Then 16 < 10 is false and the loop terminates.'),

('nested loops', 'medium', 'count = 0
for i in range(2):
    for j in range(3):
        count += 1
print(count)', '5', '6', '9', 2, 'The outer loop runs 2 times and the inner loop runs 3 times for each outer iteration. Total iterations: 2 * 3 = 6.'),

('if/else', 'medium', 'score = 75
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "D"
print(grade)', 'B', 'C', 'D', 2, 'score is 75, which is less than 90 and 80, but greater than or equal to 70. Therefore, the elif score >= 70 branch matches and sets grade to "C".'),

('for loops', 'medium', 'text = "hello"
vowels = 0
for char in text:
    if char in "aeiou":
        vowels += 1
print(vowels)', '2', '3', '1', 1, 'In the string "hello", the letters "e" and "o" are vowels. Therefore, vowels increments twice.'),

-- Hard (3 questions)
('for loops', 'hard', 'for n in range(2, 5):
    if n % 2 == 0:
        print("E", end="")
    else:
        print("O", end="")
else:
    print("X")', 'EOEX', 'EOX', 'EOE', 1, 'range(2, 5) iterates over 2, 3, and 4 printing "E", "O", and "E" respectively. Since the loop completes without hitting a break statement, the for-else block executes and prints "X", resulting in "EOEX".'),

('break', 'hard', 'i = 0
while i < 5:
    i += 1
    if i == 3:
        continue
    if i == 4:
        break
print(i)', '3', '4', '5', 2, 'i increments: at i=1 and i=2 nothing special happens. At i=3, continue skips the rest of the block. Next iteration i becomes 4, matching if i == 4: break. The loop terminates leaving i equal to 4.'),

('nested loops', 'hard', 'res = 0
for i in range(1, 4):
    for j in range(1, 4):
        if i == j:
            continue
        res += 1
print(res)', '6', '9', '3', 1, 'There are 3 * 3 = 9 total pairs of (i, j). The condition i == j is true for (1,1), (2,2), and (3,3), skipping res += 1 three times. Thus, res is incremented 9 - 3 = 6 times.');
