/* ---------------- Reusable ToDo Widget ---------------- */

function render_open_todos(frm) {
    if (!frm.fields_dict.custom_open_todo_html) return;

    const $wrapper = frm.fields_dict.custom_open_todo_html.$wrapper;
    $wrapper.empty();

    render_todo_layout($wrapper);

    let current_filter = "my"; // default filter

    function load_todos() {
        const filters = {
            reference_type: frm.doctype,   // auto detect: Lead or Opportunity
            reference_name: frm.doc.name
        };
        if (current_filter === "my") {
            filters.allocated_to = frappe.session.user;
        }

        frappe.call({
            method: "frappe.client.get_list",
            args: { doctype: "ToDo", filters, fields: todo_fields() },
            callback: (r) => render_todo_list($wrapper, r.message || [], load_todos, frm)
        });
    }

    // filter toggle
    $wrapper.on("click", ".todo-filter-btn", function() {
        $wrapper.find(".todo-filter-btn").removeClass("active");
        $(this).addClass("active");
        current_filter = $(this).data("filter");
        load_todos();
    });

    // add button
    $wrapper.on("click", "#add_todo_btn", () => open_add_todo_dialog(frm, load_todos));

    load_todos();
}

/* ---------------- Attach ToDo Widget ---------------- */

frappe.ui.form.on("Lead", {
    refresh(frm) {
        if (!frm.is_new()) render_open_todos(frm);
    }
});

frappe.ui.form.on("Opportunity", {
    refresh(frm) {
        if (!frm.is_new()) render_open_todos(frm);
    }
});

/* ---------------- Helper Functions ---------------- */

function render_todo_layout($wrapper) {
    $wrapper.html(`
<div class="todo-container">
  <div class="todo-header">
    <div class="todo-filters">
      <button class="todo-filter-btn active" data-filter="my">My ToDo</button>
      <button class="todo-filter-btn" data-filter="team">Team ToDo</button>
    </div>
    <button class="btn btn-sm btn-primary" id="add_todo_btn">+ Add</button>
  </div>
  <ul class="todo-list" id="todo_list"></ul>
</div>`);
}

function todo_fields() {
    return ["name","description","status","date","custom_remark","allocated_to"];
}

function render_todo_list($wrapper, data, reloadFn, frm) {
    const $list = $wrapper.find("#todo_list");
    $list.empty();

    if (!data.length) {
        $list.append(`<div class="todo-empty">No tasks yet</div>`);
        return;
    }

    data.sort((a, b) => (a.status === b.status ? 0 : a.status === "Closed" ? 1 : -1));
    data.forEach(todo => $list.append(render_todo_item(todo)));

    bind_todo_events($list, reloadFn);
}

function render_todo_item(todo) {
    const isClosed = todo.status === "Closed";
    const checked = isClosed ? "checked" : "";
    const descCls = isClosed ? "done" : "";
    const remarkText = todo.custom_remark || "+ Add remark";
    const remarkCls = todo.custom_remark ? "todo-remark" : "todo-remark placeholder";
    const assignText = todo.allocated_to || "+ Assign user";
    const assignCls = todo.allocated_to ? "todo-assign" : "todo-assign placeholder";

    let onlyDate = todo.date ? todo.date.split(" ")[0] : "";
    let { badgeClass, badgeText } = compute_badge(todo.status, onlyDate);

    const menuHtml = !isClosed ? `
      <div class="todo-menu">⋮</div>
      <div class="todo-menu-popup"><button class="delete-todo">🗑 Delete</button></div>` : "";

    return `
<li class="todo-item" data-todo="${frappe.utils.escape_html(todo.name)}" data-status="${todo.status}">
  <input type="checkbox" class="todo-check" ${checked}>
  <div class="todo-details">
    <div class="todo-row">
      <div class="todo-desc ${descCls}" data-field="description">${frappe.utils.escape_html(todo.description || "")}</div>
      <div class="todo-badge ${badgeClass}" data-field="date" data-date="${onlyDate}">${badgeText}</div>
    </div>
    <div class="${remarkCls}" data-field="custom_remark">${frappe.utils.escape_html(remarkText)}</div>
    <div class="${assignCls}" data-field="allocated_to">${frappe.utils.escape_html(assignText)}</div>
  </div>
  ${menuHtml}
</li>`;
}

function compute_badge(status, onlyDate) {
    let badgeClass = "nodate";
    let badgeText = "No due date";

    if (onlyDate) {
        const due = frappe.datetime.str_to_obj(onlyDate);
        const now = new Date();
        const diff = (due - now) / 1000;

        if (status === "Closed") {
            badgeClass = "closed";
            badgeText = "Fulfilled on " + frappe.datetime.str_to_user(onlyDate);
        } else if (diff < 0) {
            badgeClass = "overdue";
            badgeText = "Overdue by " + format_duration(Math.abs(diff));
        } else {
            badgeClass = "due";
            badgeText = "Due in " + format_duration(diff);
        }
    }

    return { badgeClass, badgeText };
}

function format_duration(seconds) {
    let days = Math.floor(seconds / (3600*24));
    let hours = Math.floor((seconds % (3600*24)) / 3600);
    let mins = Math.floor((seconds % 3600) / 60);
    let parts = [];
    if (days) parts.push(days + "d");
    if (hours) parts.push(hours + "h");
    if (mins) parts.push(mins + "m");
    return parts.length ? parts.join(" ") : "0m";
}

function bind_todo_events($list, reloadFn) {
    $list.find(".todo-check").on("change", function(){
        save_todo($(this).closest(".todo-item"), { status: $(this).is(":checked") ? "Closed" : "Open" }, reloadFn);
    });

    $list.find(".todo-item[data-status='Open'] .todo-desc").on("click", function(){
        inline_edit($(this), "description", reloadFn);
    });

    $list.find(".todo-item[data-status='Open'] .todo-remark").on("click", function(){
        inline_edit($(this), "custom_remark", reloadFn);
    });

    $list.find(".todo-item[data-status='Open'] .todo-assign").on("click", function(){
        inline_assign($(this), reloadFn);
    });

    $list.find(".todo-item[data-status='Open'] .todo-badge").on("click", function(){
        inline_date($(this), reloadFn);
    });

    $list.find(".todo-item[data-status='Open'] .delete-todo").on("click", function(){
        const $item = $(this).closest(".todo-item");
        frappe.confirm("Delete this task?", () => {
            frappe.call({
                method: "frappe.client.delete",
                args: { doctype: "ToDo", name: $item.data("todo") },
                callback: reloadFn
            });
        });
    });

    $list.find(".todo-menu").off("click").on("click", function(e){
        e.stopPropagation();
        $(".todo-menu-popup").hide();
        $(this).siblings(".todo-menu-popup").show();
    });
    $(document).off("click.todoMenu").on("click.todoMenu", () => $(".todo-menu-popup").hide());
}

function save_todo($item, values, reloadFn) {
    frappe.call({
        method: "frappe.client.set_value",
        args: { doctype: "ToDo", name: $item.data("todo"), fieldname: values },
        callback: reloadFn
    });
}

/* ----- Inline Editors ----- */

function inline_edit($div, field, reloadFn) {
    if ($div.find("input").length) return;
    const text = $div.hasClass("placeholder") ? "" : $div.text().trim();
    const $input = $(`<input type="text" class="todo-remark-input" value="${frappe.utils.escape_html(text)}">`);
    $div.replaceWith($input);
    $input.focus();

    $input.on("blur keydown", e => {
        if (e.type === "blur" || e.key === "Enter") {
            save_todo($input.closest(".todo-item"), { [field]: $input.val() }, reloadFn);
        }
    });
}

function inline_assign($div, reloadFn) {
    if ($div.find("select").length) return;
    const currentVal = $div.text().trim() === "+ Assign user" ? "" : $div.text().trim();
    const $select = $('<select class="todo-assign-select"></select>');
    $div.replaceWith($select);

    frappe.call({
        method: "frappe.client.get_list",
        args: { doctype: "User", filters: { enabled: 1 }, fields: ["name","full_name","email"], limit_page_length: 50 },
        callback: r => {
            $select.append('<option value="">-- Select User --</option>');
            (r.message || []).forEach(u => {
                const label = `${u.full_name || u.name} (${u.email || u.name})`;
                const selected = (u.name === currentVal) ? "selected" : "";
                $select.append(`<option value="${u.name}" ${selected}>${label}</option>`);
            });
            $select.focus();
        }
    });

    $select.on("change blur", function(){
        save_todo($select.closest(".todo-item"), { allocated_to: $(this).val() }, reloadFn);
    });
}

function inline_date($div, reloadFn) {
    if ($div.find("input").length) return;
    const currentDate = $div.data("date") || "";
    const $item = $div.closest(".todo-item");
    const $input = $(`<input type="date" class="todo-date" value="${currentDate}">`);
    $div.replaceWith($input);
    $input.focus();

    $input.on("blur change", function(){
        save_todo($item, { date: $input.val() }, reloadFn);
    });
}

/* ----- Add Dialog ----- */

function open_add_todo_dialog(frm, reloadFn) {
    const d = new frappe.ui.Dialog({
        title: "Add ToDo",
        fields: [
            { fieldname: "description", label: "Description", fieldtype: "Small Text", reqd: 1 },
            { fieldname: "custom_remark", label: "Remark", fieldtype: "Data" },
            { fieldname: "allocated_to", label: "Assign To", fieldtype: "Link", options: "User" },
            { fieldname: "date", label: "Next Action Date", fieldtype: "Date", reqd: 1 }
        ],
        primary_action_label: "Create",
        primary_action(values) {
            frappe.call({
                method: "frappe.client.insert",
                args: { doc: {
                    doctype: "ToDo",
                    description: values.description,
                    custom_remark: values.custom_remark || "",
                    allocated_to: values.allocated_to || "",
                    date: values.date || null,
                    reference_type: frm.doctype,   // ✅ dynamic
                    reference_name: frm.doc.name,
                    status: "Open"
                }},
                callback: () => { d.hide(); reloadFn(); }
            });
        }
    });
    d.show();
}
