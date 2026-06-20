import frappe
from frappe.model.document import Document

class ZoomMeeting(Document):
	def validate(self):
		"""
		This method executes automatically right before a document is saved.
		Use it to write custom API handling or logic checks.
		"""
		if not self.subject:
			frappe.throw("Meeting Subject is mandatory.")
