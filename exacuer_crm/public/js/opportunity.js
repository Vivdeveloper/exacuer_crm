frappe.ui.form.on("Opportunity", {
    custom_sales_person: function(frm) {
        update_sales_person_details(frm);
    },

    before_save: function(frm) {
        // Ensure data consistency before saving
        update_sales_person_details(frm);
    }
});

function update_sales_person_details(frm) {
    if (frm.doc.custom_sales_person) {
        frappe.db.get_doc("Sales Person", frm.doc.custom_sales_person).then(doc => {
            // ✅ Set Sales Person User
            frm.set_value("custom_sales_person_user", doc.custom_sales_person_user || "");

            // ✅ Clear old child table
            frm.clear_table("custom_report_to");

            // ✅ Copy rows from Sales Person → Opportunity
            (doc.custom_report_to || []).forEach(row => {
                let d = frm.add_child("custom_report_to");
                d.report = row.report;
                d.report_person_name = row.report_person_name;
            });

            frm.refresh_field("custom_sales_person_user");
            frm.refresh_field("custom_report_to");
        });
    } else {
        // ✅ Clear all if no Sales Person
        frm.set_value("custom_sales_person_user", "");
        frm.clear_table("custom_report_to");
        frm.refresh_field("custom_sales_person_user");
        frm.refresh_field("custom_report_to");
    }
}
