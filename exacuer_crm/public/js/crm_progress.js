function render_progress_bar(frm, doctype_name) {
    let bar_id = `${doctype_name.toLowerCase()}-progress-bar`;

    frm.$wrapper.find(`#${bar_id}`).remove();

    let status_field = frm.fields_dict["status"].df;
    let stages = status_field.options ? status_field.options.split("\n") : [];
    if (stages.length === 0) return;

    let current_status = frm.doc.status || stages[0];
    let current_index = stages.indexOf(current_status);

    // Define locked stages per Doctype
    let locked_stages = {
        "Lead": ["Opportunity", "Quotation", "Lost Quotation", "Converted"],
        "Opportunity": ["Quotation", "Converted"]
    };

    // Special highlights
    let red_stage = "Do Not Contact";

    let html = `
        <div id="${bar_id}" style="margin-bottom:15px;">
            <h4 style="margin:0 0 1px 0; color:#444;">${doctype_name} Progress</h4>
            <div class="progress-bar-container">
    `;

    stages.forEach((stage, i) => {
        let is_active = (stage === current_status);
        let is_locked = (locked_stages[doctype_name] || []).includes(stage);
        let is_red = (stage === red_stage);

        // Stage Colors
        let style = "";
        if (is_red && is_active) {
            style = "background:#e53935;color:white;font-weight:bold;"; // red only when selected
        } else if (is_active) {
            style = "background:#009688;color:white;font-weight:bold;"; // current
        } else {
            style = "background:#d9e1e7;color:#333;"; // all past & future gray
        }

        // Locked stages
        if (is_locked) {
            style += "opacity:0.6; cursor:not-allowed;";
        } else {
            style += "cursor:pointer;";
        }

        let clip_path;
        if (i === 0) {
            clip_path = "polygon(0 0, calc(100% - 5px) 0, 100% 50%, calc(100% - 5px) 100%, 0 100%)";
        } else if (i === stages.length - 1) {
            clip_path = "polygon(0 0, 100% 0, 100% 100%, 0 100%, 5px 50%)";
        } else {
            clip_path = "polygon(0 0, calc(100% - 5px) 0, 100% 50%, calc(100% - 5px) 100%, 0 100%, 5px 50%)";
        }

        html += `
            <div class="${doctype_name.toLowerCase()}-step" data-stage="${stage}"
                style="flex:1;min-width:120px;padding:8px;margin:2px;text-align:center;
                       white-space:nowrap;clip-path:${clip_path};
                       ${style}">
                ${stage}
            </div>
        `;
    });

    html += `</div></div>`;

    frm.$wrapper.find(".layout-main-section-wrapper").prepend(html);

    // Attach click only for non-locked stages
    let steps = frm.$wrapper.find(`.${doctype_name.toLowerCase()}-step`);
    steps.on("click", function() {
        let new_status = $(this).data("stage");
        let is_locked = (locked_stages[doctype_name] || []).includes(new_status);

        // allow Do Not Contact clickable (red only when selected)
        if (!is_locked && new_status && new_status !== frm.doc.status) {
            frm.set_value("status", new_status);
            frm.save_or_update();
        }
    });
}

// Attach for Lead
frappe.ui.form.on("Lead", {
    refresh: function(frm) {
        render_progress_bar(frm, "Lead");
    }
});

// Attach for Opportunity
frappe.ui.form.on("Opportunity", {
    refresh: function(frm) {
        render_progress_bar(frm, "Opportunity");
    }
});

// Add CSS globally
frappe.require([], function() {
    let style = `
        <style>
            .progress-bar-container {
                display: flex;
                flex-wrap: wrap;
                gap: 0px;
                width: 100%;
            }
            .progress-bar-container div {
                text-align: center;
                transition: all 0.3s ease;
            }
            .progress-bar-container div:hover {
                transform: scale(1.05);
            }
        </style>
    `;
    if (!$("#custom-progress-bar-style").length) {
        $("head").append(`<div id="custom-progress-bar-style">${style}</div>`);
    }
});
