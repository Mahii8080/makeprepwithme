import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { Subject, Feedback, Difficulty } from '../types';
import { getRandomQuestions, findMatchingQA } from './questionBankService';


// ── Helpers ──────────────────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:4000';

const parseAiJson = (text: string) => {
    try {
        // Remove markdown code blocks if present
        let clean = text.trim();
        if (clean.startsWith('```')) {
            clean = clean.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }
        return JSON.parse(clean);
    } catch (e) {
        console.error("AI: Failed to parse JSON response:", text);
        throw e;
    }
};

// ── API Key Setup ────────────────────────────────────────────────────────────

const getGeminiApiKey = () => {
    // Primary: Vite exposes env vars via import.meta.env with VITE_ prefix
    try {
        const meta: any = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
        if (meta?.env?.VITE_GEMINI_API_KEY) {
            return meta.env.VITE_GEMINI_API_KEY;
        }
    } catch (e) { /* ignore */ }

    // Secondary: process.env fallback (SSR / Node)
    try {
        if (typeof process !== 'undefined' && process.env) {
            const key = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
            if (key) return key;
        }
    } catch (e) { /* ignore */ }

    console.error('GeminiService: No Gemini API key found! Check VITE_GEMINI_API_KEY in .env.local');
    return '';
};

const getOpenAiApiKey = () => {
    // 1. Try process.env (Vite-defined or Node)
    if (typeof process !== 'undefined' && process.env) {
        const key = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (key && key !== 'your_openai_api_key_here') return key;
    }

    // 2. Try import.meta.env (Vite standard)
    try {
        const meta: any = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
        if (meta?.env?.VITE_OPENAI_API_KEY && meta.env.VITE_OPENAI_API_KEY !== 'your_openai_api_key_here') {
            return meta.env.VITE_OPENAI_API_KEY;
        }
    } catch (e) { /* ignore */ }

    return '';
};

// ── Clients ──────────────────────────────────────────────────────────────────

let genAI: any | null = null;
let genAIKey: string = '';
const getGenAI = () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return null;
    
    // Re-initialize if key changed or was missing before
    if (!genAI || apiKey !== genAIKey) {
        genAIKey = apiKey;
        genAI = new GoogleGenAI({ apiKey });
    }
    return genAI;
};

let openaiClient: OpenAI | null = null;
const getOpenAI = () => {
    if (!openaiClient) {
        const apiKey = getOpenAiApiKey();
        if (apiKey && apiKey !== 'your_openai_api_key_here') {
            openaiClient = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        }
    }
    return openaiClient;
};

const GEMINI_MODEL = 'gemini-2.5-flash';        // Primary: confirmed working as of 2026-05-02
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite'; // Fallback if primary hits quota
const OPENAI_MODEL = 'gpt-4o-mini';

// ── Rich Emergency Question Bank (Question + Model Answer + Key Concepts) ────
interface EmergencyQA {
    question: string;
    modelAnswer: string;
    keywords: string[];
    example?: string;
}

const EMERGENCY_QA_BANK: Record<string, Record<Difficulty, EmergencyQA[]>> = {
    'JavaScript': {
        'Beginner': [
            { question: "What is the difference between 'let', 'const', and 'var'?", keywords: ['scope', 'block', 'function', 'reassign', 'redeclare', 'hoisting', 'temporal dead zone'], example: "Example: 'const PI = 3.14;' cannot be reassigned, while 'let count = 0;' can be changed later.", modelAnswer: "'var' is function-scoped and can be re-declared. 'let' is block-scoped and can be reassigned but not re-declared. 'const' is block-scoped and cannot be reassigned after declaration. Prefer 'const' by default, use 'let' when reassignment is needed, and avoid 'var'." },
            { question: "How do you create an array in JavaScript?", keywords: ['bracket', 'array', 'literal', 'new Array', 'elements', 'index', 'push'], example: "Example: const fruits = ['apple', 'banana', 'cherry'];", modelAnswer: "You can create an array using square bracket notation: const arr = [1, 2, 3]; or using the Array constructor: const arr = new Array(3). Arrays in JavaScript are zero-indexed and can hold any data type." },
            { question: "What are the basic data types in JavaScript?", keywords: ['string', 'number', 'boolean', 'null', 'undefined', 'symbol', 'bigint', 'object', 'primitive'], example: "Example: let name = 'Alice'; (string), let age = 30; (number), let isLoggedIn = true; (boolean)", modelAnswer: "JavaScript has 7 primitive types: string, number, boolean, null, undefined, symbol, and bigint. Objects (including arrays and functions) are reference types. You can check a value's type using the typeof operator." },
            { question: "How do you write a simple 'for' loop?", keywords: ['for', 'initialization', 'condition', 'increment', 'iteration', 'loop', 'counter'], example: "Example: for (let i = 0; i < 5; i++) { console.log(i); }", modelAnswer: "A for loop has three parts: initialization (let i = 0), condition (i < 5), and increment (i++). The loop runs as long as the condition is true." },
            { question: "How do you add an element to the end of an array?", keywords: ['push', 'append', 'end', 'method', 'array', 'length'], example: "Example: const arr = [1,2]; arr.push(3); // arr is now [1,2,3]", modelAnswer: "Use the push() method to add one or more elements to the end of an array. It modifies the original array and returns the new length." },
            { question: "What is the difference between null and undefined?", keywords: ['null', 'undefined', 'intentional', 'assigned', 'declared', 'value', 'absence'], example: "Example: let a = null; (intentionally empty) vs let b; (declared but not assigned, so undefined)", modelAnswer: "'undefined' means a variable has been declared but not yet assigned a value. 'null' is an intentional assignment representing 'no value'. typeof undefined is 'undefined', while typeof null is 'object' (a known JS quirk)." },
            { question: "How do you write a comment in JavaScript?", keywords: ['comment', '//', '/*', '*/', 'single line', 'multi-line', 'documentation'], example: "Example: // This is a single-line comment. /* This is a multi-line comment */", modelAnswer: "Use // for single-line comments and /* ... */ for multi-line comments. Comments are ignored by the JavaScript engine and are used for documentation or to disable code temporarily." },
            { question: "What does the 'typeof' operator do?", keywords: ['typeof', 'type', 'string', 'number', 'boolean', 'object', 'check', 'returns'], example: "Example: typeof 'hello' returns 'string', typeof 42 returns 'number', typeof null returns 'object'.", modelAnswer: "The typeof operator returns a string indicating the data type of a value. It is commonly used to check the type of a variable before performing operations on it." },
            { question: "How do you define a function in JavaScript?", keywords: ['function', 'keyword', 'parameters', 'return', 'declaration', 'expression', 'arrow'], example: "Example: function add(a, b) { return a + b; } or const add = (a, b) => a + b;", modelAnswer: "Functions can be defined using the function keyword (declaration), as a function expression stored in a variable, or as an arrow function. All accept parameters and can return a value using the return statement." },
            { question: "What is string concatenation?", keywords: ['concatenation', 'join', '+', 'combine', 'string', 'template literal', 'backtick'], example: "Example: 'Hello' + ' ' + 'World' gives 'Hello World'. Or using template literal: `Hello ${name}`", modelAnswer: "String concatenation is the process of joining two or more strings together. In JavaScript, you can use the + operator or template literals (backtick strings with ${}) for cleaner concatenation." },
        ],
        'Intermediate': [
            { question: "Can you explain the concept of closures in JavaScript?", keywords: ['closure', 'inner function', 'outer scope', 'lexical', 'encapsulation', 'private', 'access'], example: "Example: function counter() { let count = 0; return () => ++count; } Each call to counter() creates its own private count.", modelAnswer: "A closure is a function that has access to variables from its outer (enclosing) function's scope even after the outer function has returned. This is because JavaScript functions remember the scope they were created in (lexical scoping). Closures are used for data privacy, factory functions, and callbacks." },
            { question: "Explain the difference between '==' and '==='.", keywords: ['equality', 'strict', 'loose', 'type coercion', 'comparison', 'conversion'], example: "Example: 0 == '0' is true (type coercion), but 0 === '0' is false (strict type check).", modelAnswer: "'==' is loose equality, which performs type coercion before comparing. '===' is strict equality and compares both value and type without conversion. It is best practice to always use '===' to avoid unexpected bugs from implicit type coercion." },
            { question: "How does the 'this' keyword work in different contexts?", keywords: ['this', 'context', 'object', 'method', 'arrow function', 'global', 'bind', 'call'], example: "Example: In an object method, 'this' refers to the object. In an arrow function, 'this' is inherited from the surrounding scope.", modelAnswer: "The value of 'this' depends on how a function is called. In a method, 'this' is the object it belongs to. As a standalone function, 'this' is the global object (or undefined in strict mode). Arrow functions don't have their own 'this'; they inherit it from the enclosing lexical scope." },
            { question: "What is the difference between an arrow function and a regular function?", keywords: ['arrow', 'this', 'binding', 'arguments', 'constructor', 'syntax', 'shorter'], example: "Example: Arrow: const add = (a, b) => a + b; Regular: function add(a, b) { return a + b; }", modelAnswer: "Arrow functions have a shorter syntax and do not bind their own 'this', making them ideal for callbacks. They also cannot be used as constructors and do not have an 'arguments' object. Regular functions have their own 'this' and 'arguments' binding." },
            { question: "How do promises work in JavaScript?", keywords: ['promise', 'resolve', 'reject', 'then', 'catch', 'async', 'pending', 'fulfilled', 'rejected'], example: "Example: fetch('/api/data').then(res => res.json()).catch(err => console.error(err));", modelAnswer: "A Promise represents a value that may be available in the future. It has three states: pending, fulfilled, or rejected. You attach callbacks using .then() for success and .catch() for errors. Promises help manage asynchronous operations and avoid callback hell." },
            { question: "Explain what async and await mean.", keywords: ['async', 'await', 'promise', 'asynchronous', 'synchronous', 'syntax', 'try-catch'], example: "Example: async function getData() { try { const res = await fetch('/api'); const data = await res.json(); } catch(e) { console.error(e); } }", modelAnswer: "async/await is syntactic sugar over Promises. An 'async' function always returns a Promise. The 'await' keyword pauses execution inside the async function until the Promise resolves. It makes asynchronous code look and behave like synchronous code, improving readability." },
            { question: "What is event bubbling and capturing?", keywords: ['bubbling', 'capturing', 'propagation', 'parent', 'child', 'event', 'stopPropagation'], example: "Example: Clicking a button inside a div triggers the button's handler first (target), then the div's handler (bubbling up).", modelAnswer: "Event propagation has two phases. Capturing goes from the root down to the target element. Bubbling goes from the target element up to the root. By default, events bubble. You can use event.stopPropagation() to stop the event from propagating further." },
            { question: "What are higher-order functions?", keywords: ['higher-order', 'function', 'argument', 'return', 'map', 'filter', 'reduce', 'callback'], example: "Example: [1,2,3].map(x => x * 2) — map is a higher-order function that takes a callback.", modelAnswer: "A higher-order function is a function that takes one or more functions as arguments, or returns a function as its result. Common examples in JavaScript are map(), filter(), and reduce(). They are a core concept in functional programming." },
            { question: "How do you clone an object without referencing the original?", keywords: ['clone', 'copy', 'spread', 'Object.assign', 'JSON.parse', 'deep', 'shallow'], example: "Example: Shallow: const copy = { ...original }; Deep: const copy = JSON.parse(JSON.stringify(original));", modelAnswer: "For a shallow clone, use the spread operator ({ ...obj }) or Object.assign({}, obj). For a deep clone (nested objects), use JSON.parse(JSON.stringify(obj)) or structuredClone(obj). The key distinction is that shallow copies share nested references while deep copies are fully independent." },
            { question: "What is template literal syntax?", keywords: ['template literal', 'backtick', 'interpolation', '${', 'multi-line', 'string'], example: "Example: const msg = `Hello, ${username}! You have ${count} messages.`;", modelAnswer: "Template literals use backticks (`) instead of quotes and allow string interpolation with ${expression}, multi-line strings without escape characters, and tagged templates for advanced string processing. They are much cleaner than traditional string concatenation." },
            { question: "What are WeakMaps and WeakSets, and when should you use them?", keywords: ['WeakMap', 'WeakSet', 'garbage collection', 'weak reference', 'memory', 'object key'], example: "Example: const wm = new WeakMap(); wm.set(obj, 'metadata'); — when obj is garbage collected, the entry is automatically removed.", modelAnswer: "WeakMap and WeakSet hold 'weak' references to objects, meaning they do not prevent garbage collection. WeakMap keys must be objects. They are useful for storing private data associated with DOM elements or objects without causing memory leaks, since entries are automatically cleaned up." },
        ],
        'Advanced': [
            { question: "What is the Event Loop and how does it handle asynchronous code?", keywords: ['event loop', 'call stack', 'task queue', 'microtask', 'web API', 'callback', 'non-blocking'], example: "Example: setTimeout(() => console.log('later'), 0) always prints after synchronous code, even with 0ms delay, because it goes through the task queue.", modelAnswer: "The Event Loop is what allows JavaScript to perform non-blocking operations despite being single-threaded. Synchronous code runs on the Call Stack. Async operations (like setTimeout or fetch) are handled by Web APIs. Their callbacks are placed in the Task Queue or Microtask Queue. The Event Loop continuously checks if the Call Stack is empty and then pushes callbacks from the queues to the stack." },
            { question: "Explain prototypal inheritance in JavaScript.", keywords: ['prototype', 'inheritance', 'prototype chain', '__proto__', 'Object.create', 'constructor'], example: "Example: const dog = Object.create(animal); — dog inherits properties from animal through the prototype chain.", modelAnswer: "Every JavaScript object has a prototype, which is another object it inherits properties and methods from. When you access a property, JavaScript first looks at the object itself, then walks up the prototype chain until it finds the property or reaches null. This is the basis of inheritance in JavaScript, unlike class-based inheritance in Java or C++." },
            { question: "Explain the concept of currying in JavaScript.", keywords: ['currying', 'partial application', 'function', 'argument', 'transform', 'unary'], example: "Example: const multiply = a => b => a * b; const double = multiply(2); double(5) returns 10.", modelAnswer: "Currying is a technique of transforming a function that takes multiple arguments into a sequence of functions that each take a single argument. It enables partial application, where you pre-fill some arguments and create specialized functions. It is widely used in functional programming patterns." },
            { question: "How does JavaScript garbage collection work?", keywords: ['garbage collection', 'mark and sweep', 'reachability', 'reference', 'memory leak', 'heap'], example: "Example: Once a variable goes out of scope and has no more references, the garbage collector marks it for cleanup.", modelAnswer: "JavaScript uses an automatic garbage collector based on the 'mark-and-sweep' algorithm. It periodically marks all objects reachable from the root (global scope) and sweeps away everything else. Objects that are no longer referenced become unreachable and are cleaned from heap memory. Memory leaks occur when references are accidentally kept alive (e.g., inside closures or global variables)." },
            { question: "What are Javascript Proxies?", keywords: ['Proxy', 'handler', 'trap', 'get', 'set', 'intercept', 'meta-programming'], example: "Example: const p = new Proxy(obj, { get: (target, key) => key in target ? target[key] : 'default' });", modelAnswer: "A Proxy object allows you to intercept and customize fundamental operations on an object, such as property lookup, assignment, and function invocation. You define 'traps' in a handler object. Proxies are used for validation, logging, access control, and building reactive systems." },
            { question: "Explain how 'bind', 'call', and 'apply' work under the hood.", keywords: ['bind', 'call', 'apply', 'this', 'context', 'arguments', 'invoke'], example: "Example: greet.call(user, 'Hello'); greet.apply(user, ['Hello']); const boundGreet = greet.bind(user);", modelAnswer: "'call' invokes the function immediately with a given 'this' value and arguments passed individually. 'apply' does the same but accepts arguments as an array. 'bind' does not call the function immediately; instead, it returns a new function permanently bound to the given 'this'. All three allow you to control the execution context." },
            { question: "How do generators and iterators work?", keywords: ['generator', 'yield', 'iterator', 'next()', 'iterable', 'lazy', 'function*'], example: "Example: function* counter() { let i = 0; while(true) yield i++; } const gen = counter(); gen.next().value; // 0, gen.next().value; // 1", modelAnswer: "A generator function (function*) returns a generator object that conforms to the iterator protocol. Execution is paused at each yield statement and only resumes when .next() is called. This enables lazy evaluation and infinite sequences without consuming memory all at once." },
            { question: "How do web workers operate alongside the main thread?", keywords: ['web worker', 'thread', 'background', 'message', 'postMessage', 'onmessage', 'parallel'], example: "Example: const worker = new Worker('worker.js'); worker.postMessage(data); worker.onmessage = e => console.log(e.data);", modelAnswer: "Web Workers allow JavaScript to run scripts in background threads, separate from the main UI thread. They communicate with the main thread through a message-passing API using postMessage and onmessage. Workers cannot access the DOM but are ideal for CPU-intensive tasks like image processing or data parsing, preventing the UI from freezing." },
            { question: "Explain strict mode and how it changes JavaScript execution.", keywords: ['strict mode', "'use strict'", 'error', 'undeclared', 'this', 'silent error', 'global'], example: "Example: 'use strict'; x = 5; // Throws ReferenceError because x was not declared.", modelAnswer: "Strict mode is enabled by adding 'use strict'; at the top of a script or function. It changes JavaScript's behavior: undeclared variables throw errors, 'this' inside functions defaults to undefined (not the global object), duplicate parameter names are banned, and several unsafe operations are disabled. It helps catch bugs early." },
            { question: "What is the Event Loop and how does it handle asynchronous code?", keywords: ['event loop', 'call stack', 'task queue', 'microtask', 'web API', 'callback', 'non-blocking'], example: "Example: Promises (microtasks) are always resolved before setTimeout callbacks (macrotasks), even if both are ready at the same time.", modelAnswer: "Node.js uses an event-driven, non-blocking I/O model built on libuv. The event loop cycles through phases: timers, I/O callbacks, idle/prepare, poll (blocking for I/O), check (setImmediate), and close callbacks. This allows Node.js to handle thousands of concurrent connections efficiently on a single thread." },
            { question: "Explain how 'bind', 'call', and 'apply' work under the hood.", keywords: ['bind', 'call', 'apply', 'this', 'context', 'polyfill', 'function prototype'], example: "Example: A bind polyfill: Function.prototype.myBind = function(ctx) { const fn = this; return function(...args) { return fn.call(ctx, ...args); }; };", modelAnswer: "Under the hood, all three methods manipulate the 'this' binding of a function. 'call' and 'apply' use the engine's internal [[Call]] mechanism with an explicit thisArgument. 'bind' creates a new function object (a 'bound function exotic object') that permanently stores the target function and bound 'this' and arguments in internal slots." },
        ]
    },
    'Python': {
        'Beginner': [
            { question: "What are the basic data types in Python?", keywords: ['int', 'float', 'string', 'str', 'bool', 'list', 'tuple', 'dict', 'set', 'none', 'type'], example: "Example: x = 42 (int), y = 3.14 (float), name = 'Alice' (str), is_valid = True (bool)", modelAnswer: "Python's built-in data types include integers (int), floating-point numbers (float), strings (str), booleans (bool), lists (list), tuples (tuple), dictionaries (dict), sets (set), and None. You can check the type of a value using the type() function." },
            { question: "How do you define a function in Python?", keywords: ['def', 'function', 'parameters', 'return', 'colon', 'indent', 'call'], example: "Example: def greet(name): return f'Hello, {name}!'", modelAnswer: "Functions in Python are defined using the 'def' keyword followed by the function name, parentheses for parameters, and a colon. The function body is indented. Use the 'return' statement to send back a value. Functions are called by their name followed by parentheses." },
            { question: "What is a list and how do you add items to it?", keywords: ['list', 'append', 'mutable', 'ordered', 'index', 'bracket', 'extend', 'insert'], example: "Example: fruits = ['apple', 'banana']; fruits.append('cherry'); print(fruits) # ['apple', 'banana', 'cherry']", modelAnswer: "A list is a mutable, ordered collection of items enclosed in square brackets. You can add items using append() (adds to end), insert(index, item) (at a specific position), or extend() (merges another list). Lists can hold mixed data types." },
            { question: "What is the difference between a list and a tuple?", keywords: ['list', 'tuple', 'mutable', 'immutable', 'bracket', 'parenthesis', 'performance'], example: "Example: my_list = [1, 2, 3] (can be changed), my_tuple = (1, 2, 3) (cannot be changed).", modelAnswer: "Lists are mutable (can be modified after creation) and use square brackets []. Tuples are immutable (cannot be modified) and use parentheses (). Tuples are faster and use less memory, making them ideal for fixed data like coordinates or database records." },
            { question: "How do you create a dictionary?", keywords: ['dict', 'key', 'value', 'curly braces', 'access', 'pair', 'update', 'keys'], example: "Example: person = {'name': 'Alice', 'age': 30}; person['name'] returns 'Alice'.", modelAnswer: "A dictionary is created using curly braces {} with key-value pairs separated by colons. Keys must be unique and immutable. You access values using their key (dict[key]), add new pairs by assignment, and update existing values the same way." },
            { question: "What does the 'len()' function do?", keywords: ['len', 'length', 'count', 'size', 'string', 'list', 'elements', 'characters'], example: "Example: len('Hello') returns 5, len([1, 2, 3]) returns 3, len({'a': 1, 'b': 2}) returns 2.", modelAnswer: "The len() function returns the number of items in an object. For strings, it counts characters. For lists, tuples, and sets, it counts elements. For dictionaries, it counts key-value pairs. It is one of the most commonly used built-in functions." },
            { question: "How do you take user input from the console?", keywords: ['input', 'console', 'string', 'prompt', 'int()', 'float()', 'convert'], example: "Example: name = input('Enter your name: '); age = int(input('Enter your age: '))", modelAnswer: "Use the input() function to read user input from the console. It always returns a string. To use the input as a number, convert it with int() or float(). You can pass a string prompt to input() to display a message to the user." },
            { question: "What is the purpose of the 'if' statement?", keywords: ['if', 'condition', 'else', 'elif', 'boolean', 'true', 'false', 'branch'], example: "Example: if age >= 18: print('Adult') elif age >= 13: print('Teenager') else: print('Child')", modelAnswer: "The 'if' statement allows conditional execution of code. If the condition is True, the indented block runs. You can chain conditions with 'elif' and handle all other cases with 'else'. Conditions can use comparison operators (==, !=, <, >, <=, >=) and logical operators (and, or, not)." },
            { question: "How do you loop through a list?", keywords: ['for', 'loop', 'in', 'iterate', 'list', 'element', 'range', 'enumerate'], example: "Example: for fruit in ['apple', 'banana']: print(fruit) OR for i, fruit in enumerate(fruits): print(i, fruit)", modelAnswer: "Use a 'for' loop with the 'in' keyword to iterate through a list. Each iteration assigns the current element to the loop variable. Use enumerate() if you also need the index. Use range() to loop a specific number of times." },
            { question: "How do you comment multiple lines of code?", keywords: ['comment', '#', 'triple quote', '"""', "'''", 'multi-line', 'docstring'], example: "Example: # Single line.  For multiple lines, add # to each line, or use '''...''' for docstrings.", modelAnswer: "Python uses # for single-line comments. There is no official multi-line comment syntax, but you can start each line with #. Triple-quoted strings (\"\"\" or ''') are often used as multi-line comments or docstrings, though they are technically string literals." },
        ],
        'Intermediate': [
            { question: "Explain the concept of list comprehensions.", keywords: ['list comprehension', 'compact', 'expression', 'for', 'if', 'filter', 'transform'], example: "Example: squares = [x**2 for x in range(10) if x % 2 == 0] creates a list of even squares.", modelAnswer: "List comprehensions provide a concise way to create lists based on existing iterables. Syntax: [expression for item in iterable if condition]. They are generally faster than equivalent for loops and are a key Pythonic pattern for transforming and filtering data." },
            { question: "What is the difference between deep copy and shallow copy?", keywords: ['shallow copy', 'deep copy', 'copy', 'reference', 'nested', 'mutate', 'independent'], example: "Example: import copy; deep = copy.deepcopy(original) — modifying 'deep' won't affect 'original' at any level.", modelAnswer: "A shallow copy creates a new object but populates it with references to the original nested objects. A deep copy creates a fully independent clone, recursively copying all nested objects. Use copy.copy() for shallow and copy.deepcopy() for deep copies. Deep copies are essential when working with nested mutable data." },
            { question: "What are *args and **kwargs?", keywords: ['args', 'kwargs', 'variable', 'arguments', 'positional', 'keyword', 'pack', 'unpack'], example: "Example: def func(*args, **kwargs): print(args, kwargs) — func(1, 2, name='Alice') prints (1, 2) {'name': 'Alice'}", modelAnswer: "*args allows a function to accept any number of positional arguments, packing them into a tuple. **kwargs accepts any number of keyword arguments, packing them into a dictionary. They provide flexibility for functions that need to handle a variable number of inputs." },
            { question: "How do you handle exceptions in Python using try-except?", keywords: ['try', 'except', 'exception', 'error', 'finally', 'raise', 'else', 'handle'], example: "Example: try: result = 10/0 except ZeroDivisionError as e: print(f'Error: {e}') finally: print('Done')", modelAnswer: "Use a try-except block to catch and handle exceptions gracefully. Place risky code in 'try', and error-handling code in 'except'. You can specify exception types to catch specific errors. 'finally' runs regardless of whether an exception occurred. 'else' runs only if no exception was raised." },
            { question: "Explain lambda functions.", keywords: ['lambda', 'anonymous', 'inline', 'expression', 'short', 'single line', 'sorted', 'map'], example: "Example: double = lambda x: x * 2; sorted(items, key=lambda x: x['age'])", modelAnswer: "A lambda function is an anonymous, inline function defined with the 'lambda' keyword. It can have any number of parameters but only one expression, which is implicitly returned. Lambdas are commonly used with functions like sorted(), map(), and filter() for short, throwaway functions." },
            { question: "Explain the difference between a generator and a standard function.", keywords: ['generator', 'yield', 'iterator', 'lazy', 'memory', 'next()', 'state'], example: "Example: def count_up(n): for i in range(n): yield i — values are generated one at a time, not all at once.", modelAnswer: "A generator function uses 'yield' instead of 'return'. It returns a generator iterator that produces values one at a time (lazily), maintaining its internal state between calls. Unlike regular functions, generators don't compute all values at once, making them very memory-efficient for large or infinite sequences." },
            { question: "What are Python sets and when are they used?", keywords: ['set', 'unique', 'unordered', 'hash', 'intersection', 'union', 'difference', 'duplicate'], example: "Example: {1, 2, 3, 2, 1} becomes {1, 2, 3}. Use set(list) to remove duplicates from a list.", modelAnswer: "A set is an unordered collection of unique, hashable elements. Sets automatically eliminate duplicates and support mathematical operations like union (|), intersection (&), and difference (-). They are ideal for membership testing (very fast with O(1) average time) and removing duplicates." },
            { question: "What is the difference between is and ==?", keywords: ['is', '==', 'identity', 'equality', 'id()', 'object', 'value', 'reference'], example: "Example: a = [1,2]; b = [1,2]; a == b is True (same value) but a is b is False (different objects).", modelAnswer: "'==' checks value equality — whether two objects have the same value. 'is' checks identity — whether two variables point to the exact same object in memory (same id()). You should use 'is' only for comparing with None (e.g., x is None), and use '==' for value comparisons." },
            { question: "How do you manage dependencies and environments in Python?", keywords: ['virtualenv', 'venv', 'pip', 'requirements.txt', 'conda', 'environment', 'packages'], example: "Example: python -m venv env → source env/bin/activate → pip install requests → pip freeze > requirements.txt", modelAnswer: "Use 'venv' to create isolated virtual environments for each project. Activate the environment, then install dependencies with pip. Use 'pip freeze > requirements.txt' to record dependencies and 'pip install -r requirements.txt' to restore them. This prevents version conflicts between projects." },
            { question: "How do you read from and write to a file?", keywords: ['open', 'read', 'write', 'with', 'close', 'mode', 'file', 'append', 'readline'], example: "Example: with open('data.txt', 'r') as f: content = f.read() — the 'with' statement automatically closes the file.", modelAnswer: "Use the open() function with a mode: 'r' for reading, 'w' for writing (overwrites), 'a' for appending. Always use the 'with' statement (context manager) so the file is automatically closed after the block, even if an error occurs. Use f.read(), f.readline(), or f.readlines() to read content." },
            { question: "What are metaclasses and when would you use them?", keywords: ['metaclass', 'type', 'class creation', 'customize', '__new__', '__init__', 'framework'], example: "Example: class Meta(type): def __new__(mcs, name, bases, ns): print(f'Creating class {name}'); return super().__new__(mcs, name, bases, ns)", modelAnswer: "A metaclass is the class of a class — it defines how a class behaves when created. 'type' is the default metaclass. You can create custom metaclasses to customize class creation, add methods automatically, or enforce coding standards. They are an advanced feature used in ORM frameworks like Django and SQLAlchemy." },
        ],
        'Advanced': [
            { question: "Explain the concept of decorators in Python.", keywords: ['decorator', 'wrapper', '@', 'function', 'higher-order', 'modify', 'functools', 'wraps'], example: "Example: @login_required above a view function automatically checks authentication before the function runs.", modelAnswer: "A decorator is a higher-order function that takes a function, extends its behavior, and returns the modified function. The @ syntax is syntactic sugar for func = decorator(func). Decorators are used for logging, timing, authentication, caching, and more. Use functools.wraps to preserve the original function's metadata." },
            { question: "How does Python's Global Interpreter Lock (GIL) work?", keywords: ['GIL', 'thread', 'CPython', 'mutex', 'lock', 'bytecode', 'multiprocessing', 'I/O'], example: "Example: Even with 4 CPU threads, Python threads for CPU-bound tasks won't truly run in parallel due to the GIL. Use multiprocessing instead.", modelAnswer: "The GIL is a mutex in CPython that ensures only one thread executes Python bytecode at a time. This simplifies memory management but prevents true parallel execution for CPU-bound threads. For I/O-bound tasks, threads are still efficient since they release the GIL during waiting. For CPU parallelism, use the multiprocessing module." },
            { question: "Explain the difference between @staticmethod and @classmethod.", keywords: ['staticmethod', 'classmethod', 'cls', 'self', 'instance', 'class', 'factory', 'descriptor'], example: "Example: @classmethod def from_string(cls, s): ... — a 'classmethod' is like a factory that can create instances.", modelAnswer: "@staticmethod creates a method that receives no implicit first argument. It behaves like a plain function but lives in the class namespace. @classmethod receives 'cls' (the class itself) as the first argument, allowing it to access or modify class state and create instances. Use classmethods as alternative constructors." },
            { question: "Explain multiple inheritance and the Method Resolution Order (MRO).", keywords: ['MRO', 'multiple inheritance', 'C3 linearization', 'super()', '__mro__', 'diamond', 'resolution'], example: "Example: class C(A, B): pass — Python resolves method lookups using C3 linearization. View with C.__mro__.", modelAnswer: "Python supports multiple inheritance where a class can inherit from multiple parents. To resolve ambiguity (the diamond problem), Python uses the C3 linearization algorithm (MRO). This determines a consistent order in which base classes are searched. You can inspect it with ClassName.__mro__. Always use super() to cooperatively call parent methods." },
            { question: "How does garbage collection work in Python?", keywords: ['garbage collection', 'reference counting', 'cyclic', 'gc module', '__del__', 'heap', 'refcount'], example: "Example: Python automatically frees memory when an object's reference count drops to zero. The gc module handles cyclic references.", modelAnswer: "Python primarily uses reference counting — each object tracks how many variables point to it. When the count drops to zero, the memory is freed immediately. To handle cyclic references (where objects reference each other in a loop), Python also has a cyclic garbage collector (gc module) that periodically detects and collects these cycles." },
            { question: "What is the purpose of the '__new__' and '__init__' methods?", keywords: ['__new__', '__init__', 'constructor', 'instance creation', 'cls', 'self', 'singleton', 'immutable'], example: "Example: __new__ is used when subclassing immutable types like str or int, or when implementing singleton patterns.", modelAnswer: "__new__ is the actual constructor — it creates and returns a new instance of the class. __init__ is the initializer — it receives the already-created instance (self) and sets up its attributes. __new__ is rarely overridden except when subclassing immutable types or implementing design patterns like Singleton." },
            { question: "What are context managers and how do you create a custom one?", keywords: ['context manager', 'with', '__enter__', '__exit__', 'contextlib', 'resource', 'cleanup'], example: "Example: class Timer: def __enter__(self): self.start = time.time(); return self; def __exit__(self, *args): print(time.time() - self.start)", modelAnswer: "A context manager guarantees resource cleanup using the 'with' statement. It implements the __enter__ method (called at 'with' start, returns the resource) and __exit__ (called on exit, handles cleanup even if an exception occurs). You can also create them easily using @contextlib.contextmanager with a generator function." },
            { question: "How does Python's Global Interpreter Lock (GIL) work?", keywords: ['GIL', 'thread', 'CPython', 'mutex', 'lock', 'bytecode', 'multiprocessing', 'I/O'], example: "Example: Scripts using libraries like NumPy can bypass the GIL by releasing it during C extension calls, achieving true parallelism.", modelAnswer: "Libraries like NumPy release the GIL during heavy numeric computations (C extensions), allowing other threads to run. Python 3.12+ introduced 'per-interpreter GIL' and 3.13+ allows disabling the GIL entirely (experimental). For production CPU parallelism, multiprocessing with shared memory (multiprocessing.shared_memory) remains the best approach." },
            { question: "Explain the multiprocessing module vs the threading module.", keywords: ['multiprocessing', 'threading', 'process', 'thread', 'GIL', 'CPU-bound', 'I/O-bound', 'parallel'], example: "Example: Use threading for web scraping (I/O-bound) and multiprocessing for image processing (CPU-bound).", modelAnswer: "The threading module runs threads sharing the same memory space and GIL, making it suitable for I/O-bound tasks (network, files). The multiprocessing module spawns separate processes with their own GIL and memory, enabling true parallelism for CPU-bound tasks. Use concurrent.futures for a high-level, unified interface to both." },
            { question: "What are metaclasses and when would you use them?", keywords: ['metaclass', 'ORM', 'type', 'class creation', 'framework', 'API', 'validation'], example: "Example: Django's Model uses a metaclass to automatically discover field declarations and map them to database columns.", modelAnswer: "Metaclasses are used when you need to intercept class creation to add behavior automatically. Common uses include: auto-registering subclasses (plugin systems), enforcing interfaces (like abstract base classes), modifying class attributes at definition time (ORMs), and generating code. They are powerful but complex — prefer class decorators or __init_subclass__ for simpler cases." },
            { question: "Explain the concept of decorators in Python.", keywords: ['decorator', 'class decorator', 'stacking', 'wraps', 'side effects', 'caching', 'memoize'], example: "Example: @lru_cache(maxsize=128) from functools automatically caches function results for memoization.", modelAnswer: "Advanced decorator patterns include class-based decorators (using __call__), stacking multiple decorators (applied bottom-up), and parameterized decorators (decorator factories that return a decorator). functools.lru_cache is a built-in decorator for memoization. Always use @functools.wraps(func) inside wrappers to preserve the original function's __name__ and __doc__." },
        ]
    },
    'General': {
        'Beginner': [
            { question: "What is a variable?", keywords: ['variable', 'store', 'value', 'name', 'memory', 'assign', 'data'], example: "Example: age = 25 stores the number 25 with the label 'age'. You can then use 'age' anywhere instead of typing 25.", modelAnswer: "A variable is a named storage location in memory that holds a value. You assign a value to a variable using the assignment operator (=). Variables allow programs to store, retrieve, and manipulate data dynamically, making code flexible and reusable." },
            { question: "What is the purpose of a function?", keywords: ['function', 'reuse', 'DRY', 'modular', 'organize', 'parameter', 'return', 'call'], example: "Example: Instead of writing the same calculation three times, you write it once in a function and call it three times.", modelAnswer: "A function is a reusable block of code that performs a specific task. Functions help organize code, avoid repetition (DRY principle), and make programs more modular and maintainable. They accept inputs via parameters and can return outputs. Good functions do one thing and do it well." },
            { question: "What is a 'string' in programming?", keywords: ['string', 'text', 'characters', 'sequence', 'quotes', 'immutable', 'concatenate'], example: "Example: 'Hello, World!' is a string. Strings can be joined: 'Hello' + ' ' + 'World' = 'Hello World'.", modelAnswer: "A string is a sequence of characters used to represent text. Strings are typically enclosed in single or double quotes. They are usually immutable (cannot be changed once created). Common operations include concatenation (joining), slicing, searching, and formatting." },
            { question: "What is an IDE?", keywords: ['IDE', 'integrated development environment', 'editor', 'debugger', 'autocomplete', 'code', 'VS Code'], example: "Example: VS Code, IntelliJ IDEA, and PyCharm are popular IDEs that include code editors, debuggers, and terminal access.", modelAnswer: "An IDE (Integrated Development Environment) is a software application that provides comprehensive tools for software development in one place. Key features include a code editor with syntax highlighting, autocomplete, a debugger, version control integration, and a built-in terminal. IDEs boost developer productivity." },
            { question: "What does an integer represent?", keywords: ['integer', 'whole number', 'int', 'no decimal', 'positive', 'negative', 'zero', 'arithmetic'], example: "Example: -5, 0, 42, 1000 are all integers. 3.14 is NOT an integer, it is a floating-point number.", modelAnswer: "An integer is a whole number with no fractional or decimal component. Integers can be positive, negative, or zero. In programming, integers are used for counting, indexing arrays, and arithmetic. Most languages differentiate between integers (int) and floating-point numbers (float)." },
            { question: "What is a boolean logic truth table?", keywords: ['boolean', 'true', 'false', 'AND', 'OR', 'NOT', 'logic gate', 'truth table'], example: "Example: True AND False = False. True OR False = True. NOT True = False.", modelAnswer: "A boolean truth table shows the output of logical operations (AND, OR, NOT) for all possible input combinations of True and False. AND returns True only if both inputs are True. OR returns True if at least one input is True. NOT inverts the value. These are the building blocks of all conditional logic in programming." },
            { question: "How does an if-else block work?", keywords: ['if', 'else', 'condition', 'branch', 'true', 'false', 'elif', 'execute'], example: "Example: if temperature > 30: print('Hot') else: print('Cool')", modelAnswer: "An if-else block is a conditional structure. The code in the 'if' block runs when the condition evaluates to True. The 'else' block runs when the condition is False. You can chain additional conditions using 'else if' (or 'elif' in Python). This is the foundation of decision-making in code." },
            { question: "What is debugging?", keywords: ['debugging', 'bug', 'error', 'fix', 'breakpoint', 'print', 'step through', 'identify'], example: "Example: Adding console.log() or print() statements to trace a variable's value at each step is a form of debugging.", modelAnswer: "Debugging is the process of identifying, analyzing, and fixing bugs (errors) in code. Techniques include adding print/log statements, using a debugger tool to set breakpoints and step through code line by line, rubber duck debugging (explaining code aloud), and reading error messages carefully." },
            { question: "What is pseudocode?", keywords: ['pseudocode', 'plain language', 'algorithm', 'plan', 'language-agnostic', 'logic', 'steps'], example: "Example: FOR each item IN shopping_list: PRINT item. This tells you the logic without caring about Python vs JavaScript syntax.", modelAnswer: "Pseudocode is an informal, high-level description of an algorithm written in plain language mixed with simple programming-like structures. It is language-agnostic and helps plan logic before writing actual code. Pseudocode focuses on the algorithm's steps rather than syntax details." },
            { question: "How do you comment your code?", keywords: ['comment', 'explain', 'documentation', 'readability', 'ignore', 'single line', 'inline'], example: "Example: // TODO: fix this later (JavaScript), # This function calculates tax (Python)", modelAnswer: "Comments are non-executable lines of text in code used to explain logic, document behavior, or temporarily disable code. Single-line comments use // in most C-based languages and # in Python. Multi-line comments use /* ... */ in JavaScript. Good comments explain WHY, not WHAT the code does." },
        ],
        'Intermediate': [
            { question: "Explain the difference between a stack and a queue.", keywords: ['stack', 'queue', 'LIFO', 'FIFO', 'push', 'pop', 'enqueue', 'dequeue', 'last in', 'first in'], example: "Example: Browser back-button history is a stack (LIFO). A print job queue is a queue (FIFO).", modelAnswer: "A stack follows LIFO (Last In, First Out) — the last element added is the first removed. Operations are push (add) and pop (remove from top). A queue follows FIFO (First In, First Out) — the first element added is the first removed. Operations are enqueue (add to back) and dequeue (remove from front)." },
            { question: "What is the purpose of version control like Git?", keywords: ['version control', 'Git', 'history', 'branch', 'commit', 'merge', 'collaborate', 'rollback'], example: "Example: If a bug is introduced, you can git revert to a previous commit where the code was working.", modelAnswer: "Version control systems like Git track changes to code over time, allowing developers to collaborate, review history, revert to previous states, and work on parallel features using branches. Git is distributed, meaning every developer has a full copy of the repository. GitHub hosts Git repositories online for team collaboration." },
            { question: "What are RESTful APIs?", keywords: ['REST', 'HTTP', 'GET', 'POST', 'PUT', 'DELETE', 'stateless', 'endpoint', 'JSON', 'resource'], example: "Example: GET /api/users returns all users. POST /api/users creates a new user. DELETE /api/users/1 deletes user with ID 1.", modelAnswer: "REST (Representational State Transfer) is an architectural style for building APIs using standard HTTP methods: GET (read), POST (create), PUT/PATCH (update), DELETE. RESTful APIs are stateless (no server-side session), communicate using URLs as resource identifiers, and typically exchange JSON data." },
            { question: "What is Agile methodology?", keywords: ['agile', 'sprint', 'scrum', 'iteration', 'incremental', 'user story', 'kanban', 'retrospective', 'continuous'], example: "Example: A team works in 2-week sprints, delivering a working feature at the end of each sprint, then adjusts plans based on feedback.", modelAnswer: "Agile is an iterative software development methodology that focuses on delivering working software in short cycles called sprints (typically 1-4 weeks). It emphasizes collaboration, customer feedback, and adapting to change over following a strict plan. Common frameworks include Scrum and Kanban." },
            { question: "What is the purpose of 'keys' in React lists?", keywords: ['key', 'list', 'unique', 'reconciliation', 'identifier', 'React', 'index', 'performance'], example: "Example: {users.map(user => <li key={user.id}>{user.name}</li>)} — use a stable unique ID, not the array index.", modelAnswer: "Keys help React identify which items in a list have changed, been added, or removed during re-renders (reconciliation). A key should be a stable, unique identifier (like a database ID). Avoid using array indexes as keys because they can cause bugs when the list order changes." },
            { question: "Explain what continuous integration means.", keywords: ['CI', 'continuous integration', 'automated', 'test', 'build', 'merge', 'pipeline', 'GitHub Actions'], example: "Example: Every time a developer pushes code, GitHub Actions automatically runs tests and reports if anything breaks.", modelAnswer: "Continuous Integration (CI) is the practice of automatically building and testing code every time a team member pushes changes to version control. This catches bugs early, prevents integration issues, and keeps the codebase always in a working state. Popular CI tools include GitHub Actions, Jenkins, and GitLab CI." },
            { question: "Explain the Model-View-Controller (MVC) architecture.", keywords: ['MVC', 'Model', 'View', 'Controller', 'separation', 'concerns', 'data', 'UI', 'logic'], example: "Example: In a Django app — Model is the database schema, View is the HTML template, Controller (View in Django) is the Python function handling requests.", modelAnswer: "MVC separates an application into three layers: Model (data and business logic), View (UI presentation), and Controller (receives user input and coordinates between Model and View). This separation of concerns makes applications easier to maintain, test, and scale." },
            { question: "What is test-driven development (TDD)?", keywords: ['TDD', 'test', 'red', 'green', 'refactor', 'write test first', 'unit test', 'failing'], example: "Example: Write a failing test for 'add(2,3) should return 5' → write the function → test passes → refactor the code.", modelAnswer: "TDD is a development workflow where you write a failing test first, then write the minimum code to make it pass, then refactor. This cycle is known as Red-Green-Refactor. TDD ensures code is testable from the start, drives good design, and maintains a comprehensive test suite." },
            { question: "How do you handle merge conflicts in Git?", keywords: ['merge conflict', 'git', 'resolve', 'branch', 'diff', 'HEAD', 'incoming', 'mark'], example: "Example: After 'git merge', conflict markers appear in the file (<<<<<, =====, >>>>>). You edit the file to keep the correct code, then git add and git commit.", modelAnswer: "Merge conflicts occur when two branches modify the same line of a file. Git marks the conflicting sections with conflict markers. To resolve: open the file, choose which changes to keep (or combine them), remove the markers, then 'git add' the file and 'git commit' to finalize the merge." },
            { question: "How do you stay updated with the latest trends in software development?", keywords: ['trend', 'blog', 'documentation', 'community', 'podcast', 'GitHub', 'Twitter', 'conference', 'learn'], example: "Example: Reading the official React blog, following developers on Twitter/X, attending local meetups, and building side projects.", modelAnswer: "Staying updated involves following official documentation and changelogs, reading developer blogs (Medium, dev.to), engaging with communities like Stack Overflow and Discord servers, listening to podcasts, completing online courses, and building personal projects with new technologies." },
            { question: "Tell me about a challenging technical problem you solved recently.", keywords: ['problem', 'challenge', 'solution', 'approach', 'debug', 'research', 'result', 'learned'], example: "Example: 'I faced a memory leak in our Node.js app. I profiled with --inspect, identified a closure holding references, and fixed it by restructuring the code.'", modelAnswer: "A strong answer uses the STAR method: describe the Situation (context), Task (your role), Action (steps you took — researching, debugging, collaborating), and Result (the outcome). Focus on your problem-solving process, what you learned, and the positive impact of your solution." },
        ],
        'Advanced': [
            { question: "Explain the SOLID principles of software design.", keywords: ['SOLID', 'Single Responsibility', 'Open Closed', 'Liskov', 'Interface Segregation', 'Dependency Inversion', 'principle'], example: "Example: A class that validates users AND sends emails violates the Single Responsibility Principle — split it into two classes.", modelAnswer: "SOLID is an acronym: Single Responsibility (a class has one reason to change), Open/Closed (open for extension, closed for modification), Liskov Substitution (subclasses should be substitutable for their base class), Interface Segregation (prefer focused interfaces over large ones), and Dependency Inversion (depend on abstractions, not concretions). Together they produce maintainable, scalable code." },
            { question: "Explain the principles of Object-Oriented Programming (OOP).", keywords: ['OOP', 'encapsulation', 'inheritance', 'polymorphism', 'abstraction', 'class', 'object'], example: "Example: A Dog class (inherits from Animal) overrides speak() to bark — this is polymorphism in action.", modelAnswer: "OOP is based on four pillars: Encapsulation (bundling data and methods, hiding internal state), Abstraction (exposing only relevant details), Inheritance (a child class inherits properties/methods from a parent), and Polymorphism (different classes can be used through the same interface). OOP promotes code reusability and models real-world entities." },
            { question: "What is the difference between Monolithic and Microservices architecture?", keywords: ['monolithic', 'microservices', 'service', 'deploy', 'scale', 'independent', 'API', 'communicate', 'single unit'], example: "Example: Netflix moved from a monolith to microservices, allowing them to scale only the recommendation service during peak hours without affecting other parts.", modelAnswer: "A monolith is a single, self-contained application where all components are tightly coupled and deployed together. Microservices breaks the application into small, independent services that communicate via APIs. Microservices offer better scalability and independent deployments but add operational complexity with distributed systems." },
            { question: "Explain CAP theorem.", keywords: ['CAP', 'consistency', 'availability', 'partition tolerance', 'distributed', 'trade-off', 'network'], example: "Example: During a network partition, MongoDB can be configured to prioritize Consistency (CP) over Availability, or Cassandra to prioritize Availability (AP).", modelAnswer: "CAP theorem states that a distributed system can only guarantee two of three properties simultaneously: Consistency (every read returns the most recent write), Availability (every request receives a response), and Partition Tolerance (system operates despite network partitions). Since partition tolerance is practically mandatory, real systems choose between CP and AP." },
            { question: "What are the trade-offs between SQL and NoSQL databases?", keywords: ['SQL', 'NoSQL', 'schema', 'ACID', 'scale', 'flexible', 'relational', 'document', 'horizontal', 'vertical'], example: "Example: Use SQL (PostgreSQL) for a banking app needing ACID transactions. Use NoSQL (MongoDB) for a catalog app with varying product attributes.", modelAnswer: "SQL databases use a fixed schema, support ACID transactions, and scale vertically. They excel at complex queries and relational data. NoSQL databases (document, key-value, graph, column) have flexible schemas, scale horizontally, and handle unstructured or high-volume data well. The choice depends on data structure, consistency needs, and scale requirements." },
            { question: "How do you design a database schema for high scalability?", keywords: ['normalization', 'denormalization', 'partition', 'sharding', 'index', 'caching', 'read replica', 'vertical scaling'], example: "Example: Sharding: route user IDs 1-1M to shard 1, 1M-2M to shard 2. Add read replicas for heavy read traffic.", modelAnswer: "Scalable schema design includes: proper indexing on frequently queried columns, normalization to reduce data redundancy, denormalization for read-heavy workloads, horizontal sharding (partitioning data across multiple servers), using read replicas for read scaling, caching hot data (Redis), and choosing appropriate data types to minimize storage." },
            { question: "How do you handle security vulnerabilities like SQL Injection or XSS?", keywords: ['SQL injection', 'XSS', 'sanitize', 'parameterized query', 'escape', 'CSP', 'CSRF', 'prepared statement', 'input validation'], example: "Example: SQL Injection fix: use parameterized queries like db.query('SELECT * FROM users WHERE id = ?', [userId]) instead of string interpolation.", modelAnswer: "SQL Injection is prevented by using parameterized queries/prepared statements and an ORM, never building queries with string concatenation. XSS (Cross-Site Scripting) is prevented by escaping/sanitizing user output and using Content Security Policy (CSP) headers. General defenses include input validation, output encoding, using HTTPS, and applying the principle of least privilege." },
            { question: "How do you optimize an application for extremely high traffic?", keywords: ['cache', 'CDN', 'load balancer', 'horizontal scale', 'database index', 'queue', 'async', 'microservices'], example: "Example: For a viral news article, cache the rendered page in Redis for 60 seconds, serve static assets via CDN, and put image uploads in a background queue.", modelAnswer: "High-traffic optimization involves: caching at multiple layers (browser, CDN, application, database), using a load balancer to distribute traffic across multiple servers, horizontal scaling (adding more server instances), database query optimization and indexing, async processing with message queues (Kafka, RabbitMQ), and separating read/write workloads with database replicas." },
            { question: "Explain how containerization (like Docker) works under the hood.", keywords: ['Docker', 'container', 'image', 'namespace', 'cgroup', 'Dockerfile', 'layer', 'isolation'], example: "Example: docker run -p 8080:80 nginx creates a container from the nginx image, maps port 80 in the container to port 8080 on the host.", modelAnswer: "Docker containers use Linux kernel features: namespaces (for process, network, and filesystem isolation) and cgroups (to limit CPU, memory, and I/O resources). A Docker image is a read-only layered filesystem built from a Dockerfile. Containers share the host OS kernel but are isolated from each other, making them lightweight vs. virtual machines." },
            { question: "Explain the principles of Object-Oriented Programming (OOP).", keywords: ['SOLID', 'design pattern', 'factory', 'strategy', 'observer', 'composition', 'favor'], example: "Example: Favor composition over inheritance — a Car 'has-a' Engine rather than 'is-a' MotorizedObject. This avoids deep inheritance chains.", modelAnswer: "Beyond the four pillars, advanced OOP practice includes: favoring composition over inheritance to avoid fragile base class problems, applying design patterns (Factory, Strategy, Observer), following SOLID principles, and using interfaces/abstract classes to program against abstractions. The goal is always flexible, maintainable, and testable code." },
            { question: "How would you describe your process for debugging a complex issue?", keywords: ['reproduce', 'isolate', 'hypothesis', 'logs', 'breakpoint', 'binary search', 'root cause', 'fix', 'test'], example: "Example: A bug appears only in production. Steps: reproduce locally with production data, add logging, binary search the codebase, identify the root cause, fix and write a regression test.", modelAnswer: "Effective debugging follows a systematic process: 1) Reproduce the issue consistently, 2) Gather information from logs, error messages, and user reports, 3) Form a hypothesis about the root cause, 4) Use binary search of the codebase (comment/isolate sections) or debugger breakpoints to narrow it down, 5) Fix the root cause (not just the symptom), 6) Write a test to prevent regression." },
        ]
    }
};

// Build backward-compatible EMERGENCY_QUESTIONS from the QA bank
const EMERGENCY_QUESTIONS: Record<string, Record<Difficulty, string[]>> = {} as any;
for (const domain of Object.keys(EMERGENCY_QA_BANK)) {
    EMERGENCY_QUESTIONS[domain] = {} as any;
    for (const difficulty of ['Beginner', 'Intermediate', 'Advanced'] as Difficulty[]) {
        EMERGENCY_QUESTIONS[domain][difficulty] = EMERGENCY_QA_BANK[domain][difficulty].map(qa => qa.question);
    }
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const questionSchema = {
    type: Type.OBJECT,
    properties: {
        question: {
            type: Type.STRING,
            description: "A single interview question."
        }
    },
    required: ["question"]
};

// ── Prompts ──────────────────────────────────────────────────────────────────

const getQuestionGenerationPrompt = (subject: Subject | string, difficulty: Difficulty, previousQuestions: string[] = [], resumeText?: string): string => {
    let persona: string;
    const isResumeInterview = subject === 'Resume Interview';
    
    let resumeContext = '';
    if (resumeText) {
        if (isResumeInterview) {
            resumeContext = `\n\nCONTEXT: This is a Resume-Based Interview. The candidate's profile is:\n"""\n${resumeText}\n"""\nINSTRUCTION: Ask a technical or project-specific question based ON this resume.`;
        } else {
            resumeContext = `\n\nCONTEXT: Candidate's profile for reference:\n"""\n${resumeText}\n"""\nINSTRUCTION: You may relate the question to their background, but focus primarily on the topic '${subject}'.`;
        }
    }
    
    let avoidRepetition = previousQuestions.length > 0 ? `\n\nAvoid these previous questions:\n${previousQuestions.join('\n')}` : '';

    switch (difficulty) {
        case 'Beginner': 
            persona = "Extremely basic entry-level interviewer. Focus ONLY on core syntax, basic definitions, and fundamental concepts. Strictly avoid complex architecture or deep optimization."; 
            break;
        case 'Intermediate': 
            persona = "Professional mid-level interviewer. Focus on practical application, problem-solving, common libraries, and best practices."; 
            break;
        case 'Advanced': 
            persona = "Senior technical architect. Focus on internal architecture, high-level design patterns, performance, and complex edge cases."; 
            break;
        default: 
            persona = "Professional interviewer.";
    }

    let beginnerFallback = !isResumeInterview ? `For BEGINNER level, if no previous questions are listed, you may ask "What is ${subject} and what is it used for?".` : '';

    return `${persona} Topic: '${isResumeInterview ? 'Resume Projects and Skills' : subject}'. Target Level: '${difficulty}'. ${resumeContext}${avoidRepetition} 
    
    IMPORTANT: Ask EXACTLY ONE interview question. ${beginnerFallback} Keep the question under 35 words. Return ONLY a JSON object with a single property "question". No extra text.`;
};

// ── Core Functions ───────────────────────────────────────────────────────────

export const generateQuestion = async (subject: Subject | string, difficulty: Difficulty, previousQuestions: string[] = [], resumeText?: string): Promise<string> => {
    // ── PRIMARY: Try backend API for specialized question generation ──
    try {
        const response = await fetch(`${BACKEND_URL}/api/generate-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, difficulty, previousQuestions, resumeText }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.question === 'string' && data.question.trim().length > 0) {
                console.log('Question generated by backend successfully.');
                return data.question;
            }
        }
    } catch (err) {
        console.warn('Backend generate-question failed, falling back to direct AI:', err);
    }

    // ── SECONDARY: Direct Gemini call (try primary, then fallback model) ──
    const prompt = getQuestionGenerationPrompt(subject, difficulty, previousQuestions, resumeText);
    for (const gModel of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
        try {
            const genaiInstance = getGenAI();
            if (!genaiInstance) throw new Error("No Gemini instance");

            const result = await genaiInstance.models.generateContent({
                model: gModel,
                contents: prompt,
                config: {
                    responseMimeType: "application/json"
                }
            });

            const jsonText = result.text || '';
            const parsed = parseAiJson(jsonText);
            if (parsed.question) return parsed.question;
        } catch (geminiError: any) {
            const isQuota = geminiError?.message?.includes('429') || geminiError?.message?.includes('quota');
            console.warn(`Gemini ${gModel} failed${isQuota ? ' (quota)' : ''}, trying next...`, geminiError?.message?.substring(0, 80));
        }
    }

    // 2. Fallback to OpenAI
    const openai = getOpenAI();
    if (openai) {
        try {
            console.log("AI: Gemini failed. Falling back to OpenAI (GPT)...");
            const completion = await openai.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [
                    { role: "system", content: "You are a professional interviewer. Respond only in raw JSON format." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content || '{}';
            const parsed = parseAiJson(content);
            if (parsed.question) {
                console.log("AI: OpenAI successfully generated the question.");
                return parsed.question;
            }
        } catch (openaiError: any) {
            console.error("AI: OpenAI fallback failed:", openaiError?.message || openaiError);
        }
    } else {
        console.warn("AI: OpenAI fallback skipped (No API Key found).");
    }

    console.warn("AI: Both Gemini and OpenAI failed. Using Firestore Question Bank.");

    // 3. Final Fallback — pull from Firestore question bank
    try {
        const domainName = subject.toString();
        const firestoreQuestions = await getRandomQuestions(domainName, difficulty, 1);
        if (firestoreQuestions.length > 0) {
            return firestoreQuestions[0].question;
        }
    } catch (fbErr) {
        console.warn('Firestore question fetch failed, using static fallback:', fbErr);
    }

    // 4. Absolute last resort — static fallback
    const category = Object.keys(EMERGENCY_QUESTIONS).find(k => subject.toString().includes(k)) || 'General';
    const emergencySet = EMERGENCY_QUESTIONS[category]?.[difficulty] || EMERGENCY_QUESTIONS['General'][difficulty];
    return emergencySet[Math.floor(Math.random() * emergencySet.length)];
};

export const evaluateAnswer = async (question: string, answer: string, subject: Subject | string, difficulty: Difficulty, imageB64Data?: string | null, sessionId?: string, userId?: string): Promise<Feedback> => {
    // ── PRIMARY: Call the backend API (avoids CORS errors when calling AI from browser) ──
    try {
        const response = await fetch(`${BACKEND_URL}/api/evaluate-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, answer, subject, difficulty, imageB64Data, sessionId, userId }),
        });
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.score === 'number' && data.feedback) {
                console.log('Feedback received from backend successfully.');
                return data as Feedback;
            }
        } else {
            console.warn('Backend evaluate-answer returned non-OK status:', response.status);
        }
    } catch (backendError: any) {
        console.warn('Backend evaluate-answer failed, trying direct AI:', backendError?.message);
    }

    // ── FALLBACK: Try Gemini directly (only works if CORS permits) ──
    const withVisual = difficulty === 'Advanced' && !!imageB64Data;
    const prompt = `You are a professional technical interviewer evaluating a candidate's answer.

Subject: ${subject}
Difficulty Level: ${difficulty}
Question Asked: "${question}"
Candidate's Answer: "${answer}"
${withVisual ? "\nAlso analyze the candidate's facial expression for confidence, eye contact, and engagement." : ""}

Evaluate the answer and return a JSON object with exactly these fields:
- "score": integer from 0-10 (0 = completely wrong, 5 = partially correct, 8-9 = very good, 10 = perfect)
- "feedback": string (2-4 sentences) — explain what was correct, what was missing/wrong, and how to improve
- "suggestedAnswer": string (3-6 sentences) — provide a clear, complete model answer the candidate should have given
${withVisual ? '- "nonVerbalFeedback": string — 1-2 sentences about body language, confidence, eye contact from the video' : '- "nonVerbalFeedback": null'}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text.`;

    // Try both Gemini models (primary then lite fallback)
    const geminiModels = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];
    for (const gModel of geminiModels) {
        try {
            const genaiInstance = getGenAI();
            if (!genaiInstance) throw new Error("No Gemini instance");

            const parts: any[] = [{ text: prompt }];
            if (withVisual && imageB64Data) {
                parts.push({
                    inlineData: { mimeType: 'image/jpeg', data: imageB64Data.split(',')[1] }
                });
            }

            const result = await genaiInstance.models.generateContent({
                model: gModel,
                contents: [{ role: 'user', parts }],
                config: {
                    responseMimeType: "application/json"
                }
            });
            const jsonText = result.text || '';
            const parsed = parseAiJson(jsonText);
            if (parsed && typeof parsed.score === 'number' && parsed.feedback) {
                return parsed as Feedback;
            }
            throw new Error(`${gModel} returned an incomplete JSON response`);
        } catch (e: any) {
            const isQuota = e?.message?.includes('429') || e?.message?.includes('quota');
            console.warn(`Direct Gemini evaluation (${gModel}) failed${isQuota ? ' [quota]' : ''}:`, e?.message?.substring(0, 80));
        }
    }

    // ── FINAL FALLBACK: OpenAI ──
    const openaiClient = getOpenAI();
    if (openaiClient) {
        try {
            const completion = await openaiClient.chat.completions.create({
                model: OPENAI_MODEL,
                messages: [{ role: "user", content: prompt + "\n\nIMPORTANT: Return ONLY raw JSON. No markdown blocks." }],
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content || '{}';
            const parsed = parseAiJson(content);
            if (parsed && typeof parsed.score === 'number' && parsed.feedback) {
                return parsed as Feedback;
            }
            throw new Error("OpenAI returned an incomplete JSON response");
        } catch (e: any) {
            console.error("OpenAI evaluation failed:", e?.message || e);
        }
    }

    // ── SMART LOCAL FEEDBACK ENGINE (Powered by Firestore QA Bank) ──
    const userWords = (answer || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const answerLength = userWords.length;

    // Try to find matching QA from Firestore
    let matchedQA: EmergencyQA | null = null;
    try {
        const dbMatch = await findMatchingQA(question, subject.toString(), difficulty);
        if (dbMatch) matchedQA = dbMatch as EmergencyQA;
    } catch {
        // Fallback to local bank
        const category = Object.keys(EMERGENCY_QA_BANK).find(k => subject.toString().toLowerCase().includes(k.toLowerCase())) || 'General';
        const qaSet = EMERGENCY_QA_BANK[category]?.[difficulty] || EMERGENCY_QA_BANK['General'][difficulty];
        for (const qa of qaSet) {
            const qLower = qa.question.toLowerCase();
            const inputLower = question.toLowerCase();
            const overlap = qLower.split(' ').filter(w => w.length > 3 && inputLower.includes(w)).length;
            if (overlap >= 3) { matchedQA = qa; break; }
        }
    }

    // Keyword match scoring
    let matchedKeywords: string[] = [];
    let missingKeywords: string[] = [];
    if (matchedQA) {
        for (const kw of matchedQA.keywords) {
            const kwLower = kw.toLowerCase();
            const found = userWords.some(w => w.includes(kwLower) || kwLower.includes(w));
            if (found) matchedKeywords.push(kw);
            else missingKeywords.push(kw);
        }
    }

    const totalKeywords = matchedQA?.keywords.length || 1;
    const keywordScore = matchedKeywords.length / totalKeywords;
    const lengthScore = answerLength > 30 ? 1 : answerLength > 15 ? 0.8 : answerLength > 7 ? 0.5 : 0.2;
    const rawScore = Math.round((keywordScore * 0.65 + lengthScore * 0.35) * 10);
    const finalScore = Math.max(1, Math.min(10, rawScore));

    // Generate detailed feedback text
    let feedbackParts: string[] = [];

    // 1. Opening assessment
    if (finalScore >= 8) {
        feedbackParts.push(`Excellent answer! You demonstrated a strong understanding of the concept.`);
    } else if (finalScore >= 6) {
        feedbackParts.push(`Good attempt! You touched on some key ideas, but your answer can be more complete.`);
    } else if (finalScore >= 4) {
        feedbackParts.push(`You have a basic understanding, but your answer is missing several important concepts.`);
    } else {
        feedbackParts.push(`Your answer needs significant improvement. Try to focus on the core concept of the question.`);
    }

    // 2. Mention what they got right
    if (matchedKeywords.length > 0) {
        feedbackParts.push(`✅ You correctly mentioned: **${matchedKeywords.slice(0, 4).join(', ')}**.`);
    }

    // 3. Missing keywords
    if (missingKeywords.length > 0) {
        feedbackParts.push(`💡 Key concepts you missed: **${missingKeywords.slice(0, 4).join(', ')}**. A complete answer should include these.`);
    }

    // 4. Length feedback
    if (answerLength < 8) {
        feedbackParts.push(`📝 Grammar & Clarity: Your answer was very short (${answerLength} words). In an interview, try to give complete sentences and explain your reasoning in at least 2-3 sentences.`);
    } else if (answerLength < 20) {
        feedbackParts.push(`📝 Clarity: Your answer could be more detailed. Expand on the 'why' — not just 'what' something is, but why it matters and when you'd use it.`);
    }

    // 5. Example tip
    if (matchedQA?.example && finalScore < 8) {
        feedbackParts.push(`🔍 Pro Tip: Always back up your answer with a concrete example. ${matchedQA.example}`);
    }

    const feedbackText = feedbackParts.join(' ');
    const suggestedAnswer = matchedQA
        ? `${matchedQA.modelAnswer}${matchedQA.example ? ' ' + matchedQA.example : ''}`
        : `A strong answer for "${question}" should clearly define the concept, explain why it matters, mention its key properties (${missingKeywords.slice(0, 3).join(', ')}), and give a real-world example.`;

    return {
        score: finalScore,
        feedback: feedbackText,
        suggestedAnswer,
        error: true
    };
};

export const askCustomQuestion = async (question: string, subject: Subject | string, difficulty: Difficulty): Promise<string> => {
    const prompt = `You are an interview coach. Answer: "${question}" for ${subject} (${difficulty}). Concise, under 150 words.`;

    try {
        const genaiInstance = getGenAI();
        if (!genaiInstance) throw new Error("No Gemini instance");
        
        const result = await genaiInstance.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        });
        return result.text || '';
    } catch (e) {
        const openai = getOpenAI();
        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: OPENAI_MODEL,
                    messages: [{ role: "user", content: prompt }]
                });
                return completion.choices[0].message.content || "Error.";
            } catch (e2) {}
        }
    }
    return "I hit a snag. Please check your connection.";
};

export const analyzeResumeFile = async (base64Data: string, mimeType: string): Promise<string> => {
    const resumePrompt = `You are an expert resume parser. Extract and summarize ALL of the following from this resume document:
1. Full name and contact details (if present)
2. Skills and technical competencies (list all technologies, tools, languages)
3. Programming languages and frameworks (be specific and exhaustive)
4. Key projects — for each project: name, description, and technologies used
5. Work experience — company names, roles, duration, and key responsibilities
6. Education — degree, institution, graduation year

Provide a well-structured, comprehensive plain-text summary optimized for an AI interview coach to generate targeted technical interview questions. Be thorough — include EVERY skill, technology, and project mentioned.`;

    // Clean base64 — strip data URI prefix if present
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    // ── STEP 1: Try backend server (preferred — handles server-side quota) ──
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
        const response = await fetch(`${BACKEND_URL}/api/analyze-resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data: cleanBase64, mimeType }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.extractedText === 'string' && data.extractedText.trim().length > 0) {
                console.log('Resume analyzed via backend successfully.');
                return data.extractedText.trim();
            }
        } else {
            const payload = await response.json().catch(() => null);
            console.warn('Backend analyze-resume non-OK:', payload?.error || response.status);
        }
    } catch (backendErr: any) {
        if (backendErr?.name === 'AbortError') {
            console.warn('Backend analyze-resume timed out, falling back to direct Gemini.');
        } else {
            console.warn('Backend analyze-resume unreachable, falling back to direct Gemini:', backendErr?.message);
        }
    }

    // ── STEP 2: Direct Gemini call (supports PDF, images natively) — try both models ──
    for (const gModel of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
        try {
            const genaiInstance = getGenAI();
            if (!genaiInstance) throw new Error('No Gemini API key configured');

            console.log(`Resume: Attempting direct Gemini analysis with ${gModel}...`);
            const result = await genaiInstance.models.generateContent({
                model: gModel,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: resumePrompt },
                            { inlineData: { mimeType, data: cleanBase64 } }
                        ]
                    }
                ]
            });

            const text = (result.text || '').trim();
            if (text.length > 50) {
                console.log(`Resume analyzed via direct Gemini (${gModel}) successfully.`);
                return text;
            }
            throw new Error(`${gModel} returned an empty or too-short response.`);
        } catch (geminiErr: any) {
            const isQuota = geminiErr?.message?.includes('429') || geminiErr?.message?.includes('quota');
            console.warn(`Direct Gemini resume analysis (${gModel}) failed${isQuota ? ' [quota]' : ''}:`, geminiErr?.message?.substring(0, 80));
        }
    }

    // ── STEP 3: Direct OpenAI fallback (images only — PDF not supported) ──
    const isImage = mimeType.startsWith('image/');
    if (isImage) {
        const openaiClient = getOpenAI();
        if (openaiClient) {
            try {
                console.log('Resume: Attempting direct OpenAI analysis (image)...');
                const completion = await openaiClient.chat.completions.create({
                    model: OPENAI_MODEL,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: resumePrompt },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${cleanBase64}` } }
                            ]
                        }
                    ],
                    max_tokens: 1500,
                });
                const text = (completion.choices[0].message?.content || '').trim();
                if (text.length > 50) {
                    console.log('Resume analyzed via direct OpenAI successfully.');
                    return text;
                }
                throw new Error('OpenAI returned an empty response.');
            } catch (openaiErr: any) {
                console.warn('Direct OpenAI resume analysis failed:', openaiErr?.message || openaiErr);
            }
        }
    }

    // ── STEP 4: Hard failure — give a helpful error ──
    const fileTypeHint = mimeType === 'application/pdf'
        ? 'PDF files require the backend server to be running, OR a direct Gemini API key with sufficient quota.'
        : 'Please ensure the backend server is running at http://localhost:4000 or that a valid Gemini/OpenAI API key is configured.';

    throw new Error(
        `Resume analysis failed. All AI services are unavailable.\n${fileTypeHint}\n\nTip: Run "npm run dev:full" to start both the frontend and backend simultaneously.`
    );
};
