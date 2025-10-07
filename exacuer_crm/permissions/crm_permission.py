import frappe

def get_permission_query_conditions(user, doctype=None):
    """Show only CRM records linked to the user (Lead or Opportunity)."""
    if not doctype:
        return ""

    # ✅ Skip restriction for full-access users or when disabled
    if user in get_full_access_users() or not is_restriction_enabled():
        return ""

    # ✅ Determine correct owner field based on doctype
    if doctype == "Lead":
        owner_field = "lead_owner"
    elif doctype == "Opportunity":
        owner_field = "opportunity_owner"
    else:
        # For any other doctype, no filtering is applied
        return ""

    # ✅ Restrict visibility for regular users
    return f"""
        (`tab{doctype}`.{owner_field} = '{user}'
        OR `tab{doctype}`.custom_sales_person_user = '{user}'
        OR `tab{doctype}`.custom_sales_person IN (
            SELECT name FROM `tabSales Person`
            WHERE custom_sales_person_user = '{user}'
            OR name IN (
                SELECT parent FROM `tabSales Person Report`
                WHERE report = '{user}'
            )
        ))
    """


def has_permission(doc, user):
    """Allow opening document if linked to the user (Lead or Opportunity)."""
    if user in get_full_access_users() or not is_restriction_enabled():
        return True

    # ✅ Identify correct owner field for current doctype
    if doc.doctype == "Lead":
        owner_field = "lead_owner"
    elif doc.doctype == "Opportunity":
        owner_field = "opportunity_owner"
    else:
        # Other doctypes not restricted
        return True

    # ✅ Direct ownership or assigned user
    if user in [
        getattr(doc, owner_field, None),
        getattr(doc, "custom_sales_person_user", None),
        frappe.db.get_value("Sales Person", getattr(doc, "custom_sales_person", ""), "custom_sales_person_user")
    ]:
        return True

    # ✅ Report user check
    if getattr(doc, "custom_sales_person", None):
        reports = frappe.db.get_all(
            "Sales Person Report",
            filters={"parent": doc.custom_sales_person},
            pluck="report"
        )
        if user in reports:
            return True

    return False


def get_full_access_users():
    """Fetch dynamic full-access users from Exacuer CRM Settings child table."""
    full_access_users = ["Administrator"]

    records = frappe.db.get_all(
        "Exacuer CRM User",
        fields=["user"],
        filters={
            "parenttype": "Exacuer CRM Settings",
            "parent": "Exacuer CRM Settings"
        }
    )

    for record in records:
        if record.user and record.user not in full_access_users:
            full_access_users.append(record.user.strip())

    return list(set(u.strip() for u in full_access_users if u.strip()))


def is_restriction_enabled():
    """Check if user-based restriction is enabled in Exacuer CRM Settings."""
    return bool(frappe.db.get_single_value(
        "Exacuer CRM Settings", "enable_user_based_crm_restrictions"
    ))
