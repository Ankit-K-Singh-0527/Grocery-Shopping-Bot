const response = await fetch("/generate-code");
const data = await response.json();
if (data.status === "success" && data.code) {
    currentUserCode = data.code;
    alert("New user created with code: " + currentUserCode);
    codeSet = true;
} else {
    alert("Error generating code. Please try again.");
}