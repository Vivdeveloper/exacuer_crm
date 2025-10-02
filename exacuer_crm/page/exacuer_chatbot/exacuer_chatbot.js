frappe.pages['exacuer-chatbot'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Exacuer Chatbot',
        single_column: true
    });

    // Inject CSS
    let css = `
        <style>
        .chatbot-container {
            height: 80vh;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            background: #fff;
        }
        #chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 15px;
            background: #f8f9fa;
        }
        .chat-bubble {
            display: inline-block;
            padding: 10px 14px;
            border-radius: 18px;
            margin-bottom: 10px;
            max-width: 70%;
            word-wrap: break-word;
        }
        .chat-user {
            background: #0d6efd;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
        .chat-assistant {
            background: #e9ecef;
            color: #212529;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }
        .chat-input {
            display: flex;
            border-top: 1px solid #dee2e6;
            padding: 10px;
            background: #fff;
        }
        #chat-input-box {
            flex-grow: 1;
            border-radius: 20px;
            padding: 10px 15px;
            border: 1px solid #ced4da;
            margin-right: 8px;
        }
        #chat-send {
            border-radius: 20px;
        }
        </style>
    `;
    $(css).appendTo(page.body);

    // Inject HTML
    let html = `
        <div class="chatbot-container">
            <div id="chat-messages" class="d-flex flex-column"></div>
            <div class="chat-input">
                <input id="chat-input-box" type="text" placeholder="Type your message...">
                <button id="chat-send" class="btn btn-primary">Send</button>
            </div>
        </div>
    `;
    $(html).appendTo(page.body);

    // Add message bubble
    function addMessage(role, text) {
        let cls = role === "user" ? "chat-bubble chat-user align-self-end" : "chat-bubble chat-assistant align-self-start";
        $("#chat-messages").append(`<div class="${cls}">${frappe.utils.escape_html(text)}</div>`);
        $("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);
    }

    // Handle send
    $("#chat-send").on("click", function() {
        let msg = $("#chat-input-box").val().trim();
        if(!msg) return;
        addMessage("user", msg);
        $("#chat-input-box").val("");

        frappe.call({
            method: "exacuer_crm.exacuer_crm.page.exacuer_chatbot.exacuer_chatbot.get_ai_reply",
            args: { message: msg },
            callback: function(r) {
                if(r.message) {
                    addMessage("assistant", r.message);
                } else {
                    addMessage("assistant", "⚠️ No response from AI.");
                }
            }
        });
    });

    // Enter key shortcut
    $("#chat-input-box").on("keypress", function(e) {
        if(e.which === 13) {
            $("#chat-send").click();
            return false;
        }
    });
};
