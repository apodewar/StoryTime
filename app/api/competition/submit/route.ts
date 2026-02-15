import { NextResponse } from "next/server";

type CompetitionCategory = "under-5" | "under-10" | "under-30";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const CATEGORY_LABELS: Record<CompetitionCategory, string> = {
  "under-5": "Under 5 minutes (~up to 1,000 words)",
  "under-10": "Under 10 minutes (~up to 2,000 words)",
  "under-30": "Under 30 minutes (~up to 6,000 words)",
};

const isCompetitionCategory = (value: string): value is CompetitionCategory =>
  value === "under-5" || value === "under-10" || value === "under-30";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const categoryRaw = formData.get("category");
    const storyTitleRaw = formData.get("storyTitle");
    const submitterNameRaw = formData.get("submitterName");
    const submitterEmailRaw = formData.get("submitterEmail");
    const fileRaw = formData.get("file");

    const category = typeof categoryRaw === "string" ? categoryRaw : "";
    const storyTitle = typeof storyTitleRaw === "string" ? storyTitleRaw.trim() : "";
    const submitterName =
      typeof submitterNameRaw === "string" ? submitterNameRaw.trim() : "";
    const submitterEmail =
      typeof submitterEmailRaw === "string" ? submitterEmailRaw.trim() : "";

    if (!isCompetitionCategory(category)) {
      return NextResponse.json({ error: "Invalid competition category." }, { status: 400 });
    }

    if (!storyTitle || !submitterEmail) {
      return NextResponse.json(
        { error: "Story title and submitter email are required." },
        { status: 400 },
      );
    }

    if (!(fileRaw instanceof File)) {
      return NextResponse.json({ error: "A PDF file is required." }, { status: 400 });
    }

    const fileName = fileRaw.name || "submission.pdf";
    const lowerName = fileName.toLowerCase();
    const isPdfType = fileRaw.type === "application/pdf" || lowerName.endsWith(".pdf");
    if (!isPdfType) {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    if (fileRaw.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "PDF must be 10MB or smaller." },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY ?? "";
    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Email sending is not configured yet. Missing RESEND_API_KEY." },
        { status: 503 },
      );
    }

    const toEmail = process.env.COMPETITION_TO_EMAIL ?? "apodewar@gmail.com";
    const fromEmail =
      process.env.COMPETITION_FROM_EMAIL ?? "StoryTime <onboarding@resend.dev>";

    const arrayBuffer = await fileRaw.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString("base64");
    const categoryLabel = CATEGORY_LABELS[category];

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: `StoryTime Competition Submission: ${storyTitle}`,
        html: `
          <h2>New StoryTime Competition Submission</h2>
          <p><strong>Category:</strong> ${categoryLabel}</p>
          <p><strong>Story title:</strong> ${storyTitle}</p>
          <p><strong>Submitter name:</strong> ${submitterName || "Not provided"}</p>
          <p><strong>Submitter email:</strong> ${submitterEmail}</p>
          <p>PDF is attached to this email.</p>
        `,
        text: [
          "New StoryTime Competition Submission",
          `Category: ${categoryLabel}`,
          `Story title: ${storyTitle}`,
          `Submitter name: ${submitterName || "Not provided"}`,
          `Submitter email: ${submitterEmail}`,
          "PDF is attached to this email.",
        ].join("\n"),
        attachments: [
          {
            filename: fileName,
            content: base64Content,
          },
        ],
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const resendError = payload?.message ?? payload?.error ?? "Unable to send email.";
      return NextResponse.json({ error: resendError }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid submission payload." }, { status: 400 });
  }
}
