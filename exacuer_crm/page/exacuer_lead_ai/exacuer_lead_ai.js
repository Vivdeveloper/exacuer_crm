let rotations = { frontPreview: 0, backPreview: 0 };

frappe.pages['exacuer-lead-ai'].on_page_load = function (wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Exacuer Lead AI',
        single_column: true
    });

    // ✅ Top Primary Button (View Leads)
    page.set_primary_action('📄 View Leads', function () {
        frappe.set_route('List', 'Lead');
    });

    // Load Tesseract dynamically
    if (typeof Tesseract === "undefined") {
        let script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        script.onload = () => console.log("✅ Tesseract.js loaded");
        document.head.appendChild(script);
    }

    // Layout
    $(` 
        <style>
          .upload-card { position: relative; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); transition: 0.3s; background:#fafafa; }
          .upload-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .upload-box { width:100%; height:160px; border:2px dashed #bbb; border-radius:6px;
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            cursor:pointer; overflow:hidden; transition:border-color 0.3s ease; }
          .upload-box:hover { border-color:#0b74de; }
          .upload-placeholder { text-align:center; color:#666; }
          .upload-icon { font-size:28px; margin-bottom:4px; opacity:0.7; }
          .preview-thumb { display:none; width:100%; height:100%; object-fit:contain; background:#fff; border:1px solid #eee; }
          .img-overlay { display:none; position:absolute; top:6px; right:6px; gap:6px; }
          .img-overlay button { padding:2px 6px; font-size:12px; }
          .upload-card:hover .img-overlay { display:flex; }
          #processBtn:disabled { opacity:0.7; pointer-events:none; }
          #ocr_result { border:1px solid #ddd; border-radius:6px; background:#fff; padding:8px;
            min-height:120px; white-space:pre-wrap; overflow-y:auto; max-height:200px; }
        </style>

        <div class="row p-3">
          <!-- LEFT PANEL -->
          <div class="col-md-6">
              <div class="row mb-3 text-center">
                  ${["front","back"].map(side => `
                    <div class="col-6">
                      <div class="upload-card">
                          <div class="upload-box" id="${side}Upload">
                              <div class="upload-placeholder">
                                <div class="upload-icon">☁️</div>
                                <div class="upload-text">Upload ${side.charAt(0).toUpperCase()+side.slice(1)}</div>
                                <small>Ctrl + V from clipboard</small>
                              </div>
                              <input type="file" id="${side}Input" accept="image/*" hidden />
                              <img id="${side}Preview" class="preview-thumb" />
                          </div>
                          <div class="img-overlay" id="${side}Actions">
                              <button type="button" class="btn btn-sm btn-light" onclick="rotateImage('${side}Preview')" title="Rotate 90°">🔄</button>
                              <button type="button" class="btn btn-sm btn-light" onclick="clearImage('${side}')" title="Clear">❌</button>
                          </div>
                      </div>
                    </div>
                  `).join("")}
              </div>

              <button id="processBtn" class="btn btn-dark mb-2 w-100">
                🚀 Process OCR → AI
              </button>

              <div id="ocr_result">
                👋 Upload a visiting card (Front & Back) and click Process.
              </div>
          </div>

          <!-- RIGHT PANEL -->
          <div class="col-md-6">
              <div id="lead-output" class="card p-3 shadow-sm">
                <h4 class="mb-3" id="lead-title">📇 Exacuer Lead AI – Parsed Lead Details</h4>
                <table class="table table-borderless align-middle mb-3">
                  <tbody>
                    <tr>
                      <td style="width:40px">👤</td><td><b>First Name</b></td>
                      <td><input type="text" class="form-control" id="lead_first_name" placeholder="First Name"></td>
                    </tr>
                    <tr>
                      <td>👤</td><td><b>Last Name</b></td>
                      <td><input type="text" class="form-control" id="lead_last_name" placeholder="Last Name"></td>
                    </tr>
                    <tr><td>📞</td><td><b>Phone</b></td><td><input type="text" class="form-control" id="lead_phone"></td></tr>
                    <tr><td>📱</td><td><b>Mobile</b></td><td><input type="text" class="form-control" id="lead_mobile"></td></tr>
                    <tr><td>💬</td><td><b>WhatsApp</b></td><td><input type="text" class="form-control" id="lead_whatsapp"></td></tr>
                    <tr><td>✉️</td><td><b>Email</b></td><td><input type="email" class="form-control" id="lead_email"></td></tr>
                    <tr>
                      <td>🏢</td><td><b>Company <span style="color:red">*</span></b></td>
                      <td><input type="text" class="form-control" id="lead_company" required placeholder="Company Name"></td>
                    </tr>
                    <tr><td>🌐</td><td><b>Website</b></td><td><input type="text" class="form-control" id="lead_website"></td></tr>
                    <tr><td>📍</td><td><b>City</b></td><td><input type="text" class="form-control" id="lead_city"></td></tr>
                    <tr>
                      <td>📌</td><td><b>Source</b></td>
                      <td><select class="form-control" id="lead_source"></select></td>
                    </tr>
                  </tbody>
                </table>
                <button type="button" class="btn btn-success w-100" id="saveLeadBtn">💾 Insert into ERPNext Lead</button>
                <div id="lead-insert-msg" class="mt-3"></div>
                <div class="mt-3">
                    <label><b>📝 Cleaned OCR Text (AI)</b></label>
                    <textarea id="cleaned_ocr" class="form-control" rows="6" readonly></textarea>
                </div>
              </div>
          </div>
        </div>
    `).appendTo(page.body);

    // Init Uploads
    ["front", "back"].forEach(side =>
        initUploadBox(`${side}Upload`, `${side}Preview`, `${side}Input`, `${side}Actions`)
    );

    // Global paste handler
    document.addEventListener("paste", handlePaste);

    // Load Lead Source options
    frappe.db.get_list("Lead Source", { fields: ["name"], limit: 100 })
        .then(sources => {
            let select = document.getElementById("lead_source");
            select.innerHTML = `<option value="">-- Select Source --</option>`;
            sources.forEach(s => {
                let opt = document.createElement("option");
                opt.value = s.name;
                opt.textContent = s.name;
                select.appendChild(opt);
            });
        });

    // Buttons
    document.getElementById("processBtn").addEventListener("click", processImages);
    document.getElementById("saveLeadBtn").addEventListener("click", saveLead);
};


// ---------- Upload & Preview ----------
function initUploadBox(uploadId, previewId, inputId, actionsId) {
    const box = document.getElementById(uploadId);
    const input = document.getElementById(inputId);
    const actions = document.getElementById(actionsId);

    input.addEventListener("change", e => showPreview(e, previewId, box, actions));
    box.addEventListener("click", () => input.click());

    ["dragover","dragleave"].forEach(ev =>
        box.addEventListener(ev, e => { e.preventDefault(); box.style.borderColor = ev==="dragover" ? "#0b74de" : "#bbb"; })
    );
    box.addEventListener("drop", e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) showPreview({ target:{ files:[file] } }, previewId, box, actions);
    });
}

function handlePaste(e) {
    if (e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        const target = !document.getElementById("frontPreview").src ? "front" : "back";
        showPreview({ target:{ files:[file] } },
            `${target}Preview`,
            document.getElementById(`${target}Upload`),
            document.getElementById(`${target}Actions`)
        );
    }
}

function showPreview(event, previewId, box, actions) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const img = document.getElementById(previewId);
        img.src = e.target.result; img.style.display="block";
        rotations[previewId] = 0;
        box.querySelector(".upload-placeholder").style.display="none";
        actions.style.display="flex";
        document.getElementById("processBtn").disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearImage(side) {
    ["Preview","Upload","Actions","Input"].forEach(sfx=>{
        const el=document.getElementById(side+sfx);
        if(!el)return;
        if(sfx==="Preview"){ el.src=""; el.style.display="none"; rotations[side+sfx]=0; }
        if(sfx==="Upload") el.querySelector(".upload-placeholder").style.display="block";
        if(sfx==="Actions") el.style.display="none";
        if(sfx==="Input") el.value="";
    });
}

function rotateImage(previewId) {
    const img=document.getElementById(previewId); if(!img.src)return;
    rotations[previewId]=(rotations[previewId]+90)%360;
    const original=new Image();
    original.onload=()=>{
        const c=document.createElement("canvas"),ctx=c.getContext("2d");
        [c.width,c.height]=(rotations[previewId]%180===0)?[original.width,original.height]:[original.height,original.width];
        ctx.translate(c.width/2,c.height/2); ctx.rotate(rotations[previewId]*Math.PI/180);
        ctx.drawImage(original,-original.width/2,-original.height/2);
        img.src=c.toDataURL("image/png");
    };
    original.src=img.src;
}


// ---------- OCR + AI ----------
async function processImages() {
    const front=document.getElementById("frontPreview").src;
    const back=document.getElementById("backPreview").src;
    if(!front && !back){ frappe.msgprint("Please upload at least one image."); return; }

    let btn=document.getElementById("processBtn");
    btn.innerHTML=`<span class="spinner-border spinner-border-sm"></span> Processing...`; btn.disabled=true;

    await waitForTesseract();
    let ocrText="";
    if(front) ocrText+="Front:\n"+await runOCR(front)+"\n\n";
    if(back) ocrText+="Back:\n"+await runOCR(back)+"\n\n";

    document.getElementById("ocr_result").textContent=ocrText;
    btn.innerHTML="🚀 Process OCR → AI"; btn.disabled=false;

    sendToAI(ocrText);
}

async function waitForTesseract() {
    return new Promise((res,rej)=>{
        let tries=0,check=setInterval(()=>{
            if(typeof Tesseract!=="undefined"){ clearInterval(check); res(true); }
            if(++tries>20){ clearInterval(check); rej(new Error("Tesseract.js failed to load")); }
        },300);
    });
}

async function runOCR(imgSrc) {
    const { data:{ text } }=await Tesseract.recognize(imgSrc,"eng");
    return text.trim();
}

function sendToAI(ocrText) {
    frappe.call({
        method:"exacuer_crm.exacuer_crm.page.exacuer_lead_ai.exacuer_lead_ai.analyze_text",
        args:{ text:ocrText },
        freeze:true, freeze_message:"Analyzing OCR text with AI...",
        callback:r=>{
            if(r.message){
                let d=r.message;
                $("#lead_first_name").val(d.first_name||"");
                $("#lead_last_name").val(d.last_name||"");
                $("#lead_email").val(d.email_id||"");
                $("#lead_mobile").val(d.mobile_no||"");
                $("#lead_phone").val(d.phone||"");
                $("#lead_whatsapp").val(d.whatsapp_no||"");
                $("#lead_website").val(d.website||"");
                $("#lead_company").val(d.company_name||"");
                $("#lead_city").val(d.city||"");
                $("#cleaned_ocr").val(d.raw_text||"");

                // Dynamic heading with name
                let title = document.getElementById("lead-title");
                let fullName = [d.first_name, d.last_name].filter(Boolean).join(" ");
                if (fullName) {
                    title.textContent = `📇 Exacuer Lead AI – Parsed Lead Details for ${fullName}`;
                } else {
                    title.textContent = "📇 Exacuer Lead AI – Parsed Lead Details";
                }

                // Try to select AI-suggested source
                if (d.source) {
                    let sourceDropdown = document.getElementById("lead_source");
                    [...sourceDropdown.options].forEach(opt => {
                        if (opt.value.toLowerCase() === d.source.toLowerCase()) {
                            sourceDropdown.value = opt.value;
                        }
                    });
                }
            }
        }
    });
}


// ---------- Save Lead ----------
function saveLead() {
    if (!$("#lead_company").val()) {
        frappe.msgprint("⚠️ Company Name is required to create a Lead.");
        return;
    }

    let data={
        first_name:$("#lead_first_name").val(),
        last_name:$("#lead_last_name").val(),
        source:$("#lead_source").val(),
        email_id:$("#lead_email").val(),
        mobile_no:$("#lead_mobile").val(),
        phone:$("#lead_phone").val(),
        whatsapp_no:$("#lead_whatsapp").val(),
        website:$("#lead_website").val(),
        company_name:$("#lead_company").val(),
        city:$("#lead_city").val(),
        raw_text:$("#cleaned_ocr").val()
    };

    frappe.call({
        method:"exacuer_crm.exacuer_crm.page.exacuer_lead_ai.exacuer_lead_ai.create_lead",
        args:{
            lead_data:JSON.stringify(data),
            front_image:document.getElementById("frontPreview").src || null,
            back_image:document.getElementById("backPreview").src || null
        },
        callback:r=>{
            let msgDiv = document.getElementById("lead-insert-msg");
            if(r.message){
                msgDiv.innerHTML = `
                  <div class="alert alert-success d-flex justify-content-between align-items-center">
                    ✅ Lead <b>${r.message}</b> inserted successfully.
                    <a href="/app/lead/${r.message}" target="_blank" class="btn btn-sm btn-dark">🔗 Open Lead</a>
                  </div>
                `;
                frappe.show_alert({ message:"✅ Lead created: "+r.message, indicator:"green" });
            } else {
                msgDiv.innerHTML = `<div class="alert alert-danger">⚠️ Failed to insert Lead.</div>`;
            }
        }
    });
}
