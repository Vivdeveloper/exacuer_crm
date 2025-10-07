// exacuer_crm/public/js/crm_layout.js
(function() {
    function apply_layout_styles() {
        // load CSS externally → now no inline styles
        if (!document.getElementById("crm-layout-styles")) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.id = "crm-layout-styles";
            link.href = "/assets/exacuer_crm/css/crm_layout.css";
            document.head.appendChild(link);
        }
    }

    function setup_crm_layout(frm, doctype) {
        apply_layout_styles();

        // Hide sidebar
        try { frm.page.sidebar && frm.page.sidebar.hide(); } catch (e) {}
        try { frm.page.wrapper.find(".layout-side-section").hide(); } catch (e) {}

        const wrapper = frm.$wrapper;
        const formLayout = wrapper.find(".form-layout");

        formLayout.addClass("custom-form-layout");

        // Wrap only once
        if (!wrapper.find(".crm-flex-container").length) {
            formLayout.wrap('<div class="crm-form-left"></div>');
            const flex = $('<div class="crm-flex-container"></div>');
            formLayout.parent().wrap(flex);
            wrapper.find(".crm-flex-container").append('<div class="crm-form-right"></div>');
        }
    }

    // ✅ Add-on: allow to inject new sections
    function add_section(frm, side, section_id, title, content_html = "") {
        const col = frm.$wrapper.find(`.crm-form-${side}`);
        if (!col.length) return null;

        let section = col.find(`#${section_id}`);
        if (!section.length) {
            section = $(`<div class="crm-section" id="${section_id}"></div>`);
            col.append(section);
        }
        section.html(`
            ${title ? `<h4>${frappe.utils.escape_html(title)}</h4>` : ""}
            <div class="crm-section-body">${content_html}</div>
        `);
        return section.find(".crm-section-body");
    }

    // Expose helpers globally
    window.ExacuerCRMLayout = { setup_crm_layout, add_section };

    // Attach for Lead & Opportunity
    ["Lead", "Opportunity"].forEach(dt => {
        frappe.ui.form.on(dt, {
            refresh: function(frm) {
                setup_crm_layout(frm, dt);

                // Example sections
                ExacuerCRMLayout.add_section(frm, "right", "todo-panel", "Follow-up ToDo", `
                    <div id="todo-content-${dt}"></div>
                `);
                ExacuerCRMLayout.add_section(frm, "right", "activities-panel", "Activities", `
                    <div id="activities-content-${dt}"></div>
                `);

                // 👉 Move your custom HTML field into "Follow-up ToDo"
                if (frm.fields_dict.custom_open_todo_html) {
                    const target = frm.$wrapper.find("#todo-panel .crm-section-body");
                    frm.fields_dict.custom_open_todo_html.$wrapper.detach().appendTo(target);
                }

                // Move existing activities HTML if present
                if (frm.fields_dict.all_activities_html) {
                    const target = frm.$wrapper.find(`#activities-content-${dt}`);
                    frm.fields_dict.all_activities_html.$wrapper.detach().appendTo(target);
                }
            }
        });
    });
})();
