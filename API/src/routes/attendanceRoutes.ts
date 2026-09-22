import express from 'express';
import { AttendanceService } from '../services/attendanceService';

const router = express.Router();
const attendanceService = new AttendanceService();

router.post('/mark', async (req, res) => {
  try {
    console.log('Attendance mark request received:', JSON.stringify(req.body));
    const { employeeId, date, attendanceType } = req.body;
    
    if (!employeeId || !date || !attendanceType) {
      console.log('Missing parameters:', { employeeId, date, attendanceType });
      return res.status(400).json({ error: 'Employee ID, date, and attendance type are required' });
    }
    
    if (!['full_day', 'half_day', 'absent'].includes(attendanceType)) {
      return res.status(400).json({ error: 'Attendance type must be full_day, half_day, or absent' });
    }
    
    const attendance = await attendanceService.markAttendance(
      employeeId, 
      date, 
      attendanceType
    );
    console.log('Attendance marked successfully:', attendance.id);
    res.json(attendance);
  } catch (error: any) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: error.message || 'Failed to mark attendance' });
  }
});

router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const attendance = await attendanceService.getAttendanceByEmployee(
      parseInt(req.params.employeeId),
      startDate as string,
      endDate as string
    );
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const attendance = await attendanceService.getAllAttendance(
      startDate as string,
      endDate as string
    );
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

export default router;

