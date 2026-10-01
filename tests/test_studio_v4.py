import unittest
from tools.manual_editor import server
class HoursV4Tests(unittest.TestCase):
 def test_split_closed_and_exceptions_roundtrip(self):
  hours={'1':[], '2':[['09:00','12:00'],['14:00','18:00']]}
  _,value=server.normalize_store({'nombre':'Local','weekly_hours':hours,'hours_exceptions':{'2026-12-25':[]}})
  self.assertEqual(value['weekly_hours'],hours)
  self.assertEqual(value['hours_exceptions']['2026-12-25'],[])
 def test_overlaps_rejected(self):
  for intervals in [[['09:00','15:00'],['14:00','18:00']],[['14:00','18:00'],['09:00','12:00']]]:
   with self.assertRaises(ValueError):server.normalize_store({'nombre':'Local','weekly_hours':{'1':intervals}})
if __name__=='__main__':unittest.main()
