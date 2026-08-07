import { CreateBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CreateQueueCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { lookup as lookupMime } from "mime-types";

// Hardcoding the endpoints keeps the seed script runnable standalone, independent
// of whatever the app's own config resolves to.
const S3_ENDPOINT_URL = process.env.AWS_S3_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL || "http://localhost:9000";
const SQS_ENDPOINT_URL = process.env.AWS_SQS_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL || "http://localhost:9324";
const REGION = process.env.AWS_DEFAULT_REGION || "us-east-1";
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
};

const s3 = new S3Client({ endpoint: S3_ENDPOINT_URL, region: REGION, credentials, forcePathStyle: true });
const sqs = new SQSClient({ endpoint: SQS_ENDPOINT_URL, region: REGION, credentials });

// Green 10x10 JPEG
const PHOTO_JPG =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDWooor80PyA//Z";
// Red 5x5 PNG
const DESIGN_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";

const FILES: [bucket: string, key: string, content: string | Uint8Array][] = [
  ["documents", "welcome.txt", "Welcome to the S3 UI Tool!"],
  ["documents", "project/specs.md", "# Project Specifications\n\n1. S3 Browser\n2. SQS Viewer"],
  ["documents", "config.json", '{\n  "app_name": "S3 UI Tool",\n  "version": "1.0.0",\n  "features": ["s3", "sqs"]\n}'],
  ["documents", "users.json", '[\n  {"id": 1, "name": "Alice"},\n  {"id": 2, "name": "Bob"}\n]'],
  [
    "documents",
    "scripts/deploy.ps1",
    'Write-Host "Deploying application..."\nStart-Sleep -Seconds 2\nWrite-Host "Done!"',
  ],
  ["documents", "web/index.htm", "<html><body><h1>Hello World</h1></body></html>"],
  [
    "documents",
    "styles/main.sass",
    "$font-stack: Helvetica, sans-serif\n$primary-color: #333\n\nbody\n  font: 100% $font-stack\n  color: $primary-color",
  ],
  ["documents", "docs/manual.rst", "User Manual\n===========\n\nThis is a reStructuredText document."],
  [
    "documents",
    "ui/window.xaml",
    '<Window x:Class="WpfApp1.MainWindow"\n        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"\n        Title="MainWindow" Height="450" Width="800">\n    <Grid>\n        <Button Content="Click Me" />\n    </Grid>\n</Window>',
  ],
  [
    "documents",
    "src/Program.cs",
    'using System;\n\nclass Program\n{\n    static void Main()\n    {\n        Console.WriteLine("Hello C#");\n    }\n}',
  ],
  ["images", "logo.txt", "[Fake Image Content]"],
  [
    "images",
    "icon.svg",
    '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">\n  <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />\n</svg>',
  ],
  ["images", "photo.jpg", Uint8Array.fromBase64(PHOTO_JPG)],
  ["images", "design.png", Uint8Array.fromBase64(DESIGN_PNG)],
  ["logs", "app.log", "INFO: Application started\nINFO: User logged in"],
  ["logs", "2024/01/access.log", "127.0.0.1 - - [01/Jan/2024] GET /index.html"],
  ["logs", "metrics.json", '{\n  "cpu": 45,\n  "memory": 1024,\n  "requests": 500\n}'],
];

async function seedS3(): Promise<void> {
  console.log("--- Seeding S3 ---");
  for (const bucket of ["documents", "images", "logs"]) {
    try {
      await s3.send(
        new CreateBucketCommand({
          Bucket: bucket,
          // us-east-1 must omit the location constraint; other regions require it.
          ...(REGION === "us-east-1" ? {} : { CreateBucketConfiguration: { LocationConstraint: REGION as never } }),
        }),
      );
      console.log(`Created bucket: ${bucket}`);
    } catch (e) {
      console.log(`Bucket ${bucket} might already exist or error: ${e}`);
    }
  }

  for (const [bucket, key, content] of FILES) {
    const contentType = lookupMime(key) || "application/octet-stream";
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content, ContentType: contentType }));
    console.log(`Uploaded ${key} to ${bucket} as ${contentType}`);
  }
}

async function seedSqs(): Promise<void> {
  console.log("\n--- Seeding SQS ---");
  for (const queueName of ["orders-queue", "notifications-dlq", "email-jobs"]) {
    try {
      const { QueueUrl } = await sqs.send(new CreateQueueCommand({ QueueName: queueName }));
      console.log(`Created queue: ${queueName}`);

      if (queueName === "orders-queue") {
        for (let i = 0; i < 5; i++) {
          await sqs.send(
            new SendMessageCommand({ QueueUrl, MessageBody: `{"order_id": ${1000 + i}, "status": "pending"}` }),
          );
        }
        console.log(`Sent 5 messages to ${queueName}`);
      } else if (queueName === "notifications-dlq") {
        for (let i = 0; i < 3; i++) {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl,
              MessageBody: `{"error": "Failed to send email", "retry_count": ${i + 1}, "original_message_id": "msg-${i}"}`,
            }),
          );
        }
        console.log(`Sent 3 persisted messages to ${queueName}`);
      }
    } catch (e) {
      console.log(`Error creating/seeding queue ${queueName}: ${e}`);
    }
  }
}

console.log(`Seeding S3 data to ${S3_ENDPOINT_URL}...`);
console.log(`Seeding SQS data to ${SQS_ENDPOINT_URL}...`);
try {
  await seedS3();
  await seedSqs();
  console.log("\nSeeding complete!");
} catch (e) {
  console.log(`\nError during seeding: ${e}`);
  process.exitCode = 1;
}
