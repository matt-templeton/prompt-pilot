Here’s an additional **input/output example** for your prompt, this time using **Java** as the source language. This example demonstrates how the prompt handles strongly typed languages with explicit type information and visibility modifiers.

---

### **Input (Java Code)**:
```java
/**
 * Represents a user in the system.
 */
public class User {
    private String name;
    private int age;

    /**
     * Creates a new User instance.
     * @param name The name of the user.
     * @param age The age of the user.
     */
    public User(String name, int age) {
        this.name = name;
        this.age = age;
    }

    /**
     * Gets the name of the user.
     * @return The name of the user.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name of the user.
     * @param name The new name of the user.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Gets the age of the user.
     * @return The age of the user.
     */
    public int getAge() {
        return age;
    }

    /**
     * Sets the age of the user.
     * @param age The new age of the user.
     */
    public void setAge(int age) {
        this.age = age;
    }

    /**
     * Returns a string representation of the user.
     * @return A string in the format "User[name=..., age=...]".
     */
    @Override
    public String toString() {
        return String.format("User[name=%s, age=%d]", name, age);
    }
}
```

---

### **Output (YAML API Surface)**:
```yaml
classes:
  - name: User
    description: Represents a user in the system.
    constructors:
      - arguments:
          - name: name
            type: String
            description: The name of the user.
          - name: age
            type: int
            description: The age of the user.
        description: Creates a new User instance.
    methods:
      - name: getName
        arguments: []
        return_type: String
        description: Gets the name of the user.
      - name: setName
        arguments:
          - name: name
            type: String
            description: The new name of the user.
        return_type: void
        description: Sets the name of the user.
      - name: getAge
        arguments: []
        return_type: int
        description: Gets the age of the user.
      - name: setAge
        arguments:
          - name: age
            type: int
            description: The new age of the user.
        return_type: void
        description: Sets the age of the user.
      - name: toString
        arguments: []
        return_type: String
        description: Returns a string representation of the user.
    properties:
      - name: name
        type: String
        description: The name of the user.
      - name: age
        type: int
        description: The age of the user.
```

---

### **Key Observations**:
1. **Type Information**:  
   - Java is a strongly typed language, so all types (e.g., `String`, `int`, `void`) are explicitly included in the output.  

2. **Visibility Modifiers**:  
   - Only `public` methods and constructors are included in the API surface. Private fields (`name` and `age`) are included as properties because they are exposed via public getters and setters.  

3. **Descriptions**:  
   - Descriptions are pulled directly from the Javadoc comments in the source code.  

4. **Constructors**:  
   - The constructor is included with its arguments and descriptions, but no return type is specified.  

5. **Methods**:  
   - Methods like `getName`, `setName`, `getAge`, and `setAge` are included with their arguments, return types, and descriptions.  

6. **Properties**:  
   - Properties (`name` and `age`) are included with their types and descriptions, even though they are private fields in the source code. This is because they are exposed via public methods.  

---

This example demonstrates how the prompt handles a strongly typed language like Java, ensuring that all type information, visibility rules, and descriptions are accurately reflected in the YAML output. Let me know if you'd like to see examples for other languages!

--- 
2. 

### **Input (Java Code)**:
```java
/**
 * Represents a user in the system.
 */
public class User {
    private String name;
    private int age;

    /**
     * Creates a new User instance.
     * @param name The name of the user.
     * @param age The age of the user.
     */
    public User(String name, int age) {
        this.name = name;
        this.age = age;
    }

    /**
     * Gets the name of the user.
     * @return The name of the user.
     */
    public String getName() {
        return name;
    }

    /**
     * Sets the name of the user.
     * @param name The new name of the user.
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Gets the age of the user.
     * @return The age of the user.
     */
    public int getAge() {
        return age;
    }

    /**
     * Sets the age of the user.
     * @param age The new age of the user.
     */
    public void setAge(int age) {
        this.age = age;
    }

    /**
     * Returns a string representation of the user.
     * @return A string in the format "User[name=..., age=...]".
     */
    @Override
    public String toString() {
        return String.format("User[name=%s, age=%d]", name, age);
    }
}
```

---

### **Output (YAML API Surface)**:
```yaml
classes:
  - name: User
    description: Represents a user in the system.
    constructors:
      - arguments:
          - name: name
            type: String
            description: The name of the user.
          - name: age
            type: int
            description: The age of the user.
        description: Creates a new User instance.
    methods:
      - name: getName
        arguments: []
        return_type: String
        description: Gets the name of the user.
      - name: setName
        arguments:
          - name: name
            type: String
            description: The new name of the user.
        return_type: void
        description: Sets the name of the user.
      - name: getAge
        arguments: []
        return_type: int
        description: Gets the age of the user.
      - name: setAge
        arguments:
          - name: age
            type: int
            description: The new age of the user.
        return_type: void
        description: Sets the age of the user.
      - name: toString
        arguments: []
        return_type: String
        description: Returns a string representation of the user.
    properties:
      - name: name
        type: String
        description: The name of the user.
      - name: age
        type: int
        description: The age of the user.
```

---

### **Key Observations**:
1. **Type Information**:  
   - Java is a strongly typed language, so all types (e.g., `String`, `int`, `void`) are explicitly included in the output.  

2. **Visibility Modifiers**:  
   - Only `public` methods and constructors are included in the API surface. Private fields (`name` and `age`) are included as properties because they are exposed via public getters and setters.  

3. **Descriptions**:  
   - Descriptions are pulled directly from the Javadoc comments in the source code.  

4. **Constructors**:  
   - The constructor is included with its arguments and descriptions, but no return type is specified.  

5. **Methods**:  
   - Methods like `getName`, `setName`, `getAge`, and `setAge` are included with their arguments, return types, and descriptions.  

6. **Properties**:  
   - Properties (`name` and `age`) are included with their types and descriptions, even though they are private fields in the source code. This is because they are exposed via public methods.  
