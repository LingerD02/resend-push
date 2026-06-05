// functions/api/send.js
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const method = request.method;

  // 1. 鉴权
  const authToken = request.headers.get("X-Auth-Token") || url.searchParams.get("token");
  if (authToken !== env.TOKEN) {
    return new Response(JSON.stringify({
      error: "Unauthorized",
      receivedToken: authToken,
      envTokenExists: !!env.TOKEN,
      envTokenLength: env.TOKEN ? env.TOKEN.length : 0
    }), {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // 2. 仅允许GET/POST
  if (!["GET", "POST"].includes(method)) {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let subject = "系统告警通知";
  let content = "";

  try {
    // 3. 处理GET请求（参数已改为title和content）
    if (method === "GET") {
      subject = url.searchParams.get("title") || subject;
      content = url.searchParams.get("content") || "无内容";
    } 
    // 4. 处理POST请求
    else if (method === "POST") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await request.json();
        subject = data.subject || data.title || subject; // 兼容title字段
        content = data.content || data.msg || JSON.stringify(data, null, 2);
      } else {
        content = await request.text();
      }
    }

    // 5. 调用Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Alert System <onboarding@resend.dev>",
        to: env.TO_EMAIL,
        subject: subject,
        text: content
      })
    });

    const result = await res.json();
    return new Response(JSON.stringify({
      success: res.ok,
      resend: result
    }), {
      status: res.status,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
