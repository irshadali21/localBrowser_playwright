const url = "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3025.6066734129595!2d-73.9729819!3d40.6826346!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25ba564414de7%3A0x883748ef52af604c!2sProspect%20Heights%20Plumbing%20Brooklyn!5e0!3m2!1sen!2s!4v1771763763151!5m2!1sen!2s";

console.log("URL:", url);
console.log("includes('maps.google.com/embed'):", url.includes('maps.google.com/embed'));
console.log("includes('google.com/maps/embed'):", url.includes('google.com/maps/embed'));
console.log("includes('maps'):", url.includes('maps'));
console.log("includes('google'):", url.includes('google'));
console.log("startsWith:", url.startsWith('https://www.google.com/maps/embed?pb='));

// Let's check character by character
console.log("\nURL characters:");
for (let i = 0; i < 50; i++) {
  const char = url[i];
  const code = char.charCodeAt(0);
  console.log(`${i + 1}: "${char}" (${code})`);
}
