const http = require('http')
const readline = require('readline')

const PORT = 8080

// Function to send messages to the Chrome extension
function sendMessageToExtension(message) 
{
    // Implement Native Messaging protocol to communicate with the extension
    // This typically involves reading from stdin and writing to stdout with proper framing
    // For simplicity, this is a placeholder
    console.log(JSON.stringify(message))
}

// Create HTTP server
const server = http.createServer((req, res) => 
{
    if (req.method === 'POST' && req.url === '/toggle')
    {
        sendMessageToExtension({action: "toggleMedia"})
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end('Toggle command sent.\n')
    }
    else
    {
        res.writeHead(404, {'Content-Type': 'text/plain'})
        res.end('Not Found\n')
    }
})

server.listen(PORT, () => 
{
    console.log(`Native host listening on port ${PORT}`)
})