import React, { useState, useEffect } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; // NEW: For the form
import dayjs from 'dayjs';
import { MdDeleteForever } from "react-icons/md";
import './App.css';

// MUI Core imports
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
    Box, Button, Typography, Paper, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select,
    MenuItem, FormControl, InputLabel, OutlinedInput, Checkbox, ListItemText
} from '@mui/material';

// --- 1. HELPER FUNCTIONS ---
const getLogicalDateStr = () => {
    return dayjs().subtract(6, 'hour').format('YYYY-MM-DD');
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- 2. THE SMART FILTER LOGIC ---
// This checks if an event should be active on ANY given dayjs date
const isEventActiveOnDate = (ev, targetDayjs) => {
    const targetStr = targetDayjs.format('YYYY-MM-DD');

    // 1. Check Date Boundaries (This prevents tampering with past days!)
    if (targetStr < ev.startDate) return false;
    if (ev.endDate && targetStr > ev.endDate) return false;

    // 2. Check Frequency
    if (ev.frequency === 'all') return true;
    if (ev.frequency === 'custom') return ev.customDays.includes(targetDayjs.day());

    const startDayjs = dayjs(ev.startDate);
    // Weekly: Matches the same day of the week as the start date
    if (ev.frequency === 'weekly') return targetDayjs.day() === startDayjs.day();
    // Monthly: Matches the same date of the month as the start date
    if (ev.frequency === 'monthly') return targetDayjs.date() === startDayjs.date();

    return false;
};

// --- 3. CUSTOM CALENDAR DAY ---
function TaskTrackingDay(props) {
    const { day, outsideCurrentMonth, events, ...other } = props;

    if (outsideCurrentMonth) {
        return <PickersDay day={day} outsideCurrentMonth={outsideCurrentMonth} {...other} />;
    }

    const dateStr = day.format('YYYY-MM-DD');

    // Use the new smart filter to find events for this calendar square
    const scheduledEvents = events.filter(ev => isEventActiveOnDate(ev, day));
    const isFullyCompleted = scheduledEvents.length > 0 && scheduledEvents.every(ev => (ev.progress[dateStr] || 0) >= ev.targetCount);

    return (
        <PickersDay
            day={day}
            outsideCurrentMonth={outsideCurrentMonth}
            {...other}
            sx={{
                ...(isFullyCompleted && {
                    backgroundColor: 'success.dark',
                    color: 'success.contrastText',
                    '&:hover': { backgroundColor: 'success.dark' },
                    '&.Mui-selected': { backgroundColor: 'success.dark', color: 'success.contrastText' }
                })
            }}
        />
    );
}

// --- 4. EVENTS COMPONENT ---
function AddEvents({ events, setEvents, selectedDate }) {
    const [dialogOpen, setDialogOpen] = useState(false);

    // Updated state to include dates
    const [newEvent, setNewEvent] = useState({
        title: '',
        frequency: 'all',
        customDays: [],
        targetCount: 1,
        startDate: dayjs(getLogicalDateStr()), // Defaults to "today" (respecting the 6 AM rule)
        endDate: null
    });

    const logicalTodayStr = getLogicalDateStr();
    const selectedDateStr = selectedDate.format('YYYY-MM-DD');
    const isEditable = selectedDateStr === logicalTodayStr;

    // Use the smart filter for the left panel too!
    const displayEvents = events.filter(ev => isEventActiveOnDate(ev, selectedDate));

    const handleAddEvent = () => {
        if (!newEvent.title || !newEvent.startDate) return;

        setEvents([...events, {
            id: Date.now(),
            title: newEvent.title,
            frequency: newEvent.frequency,
            customDays: newEvent.customDays,
            targetCount: newEvent.targetCount,
            // Save dates as simple standard strings
            startDate: newEvent.startDate.format('YYYY-MM-DD'),
            endDate: newEvent.endDate ? newEvent.endDate.format('YYYY-MM-DD') : null,
            progress: {}
        }]);

        setDialogOpen(false);
        // Reset form
        setNewEvent({
            title: '', frequency: 'all', customDays: [], targetCount: 1,
            startDate: dayjs(getLogicalDateStr()), endDate: null
        });
    };

    const updateProgress = (eventId, change) => {
        if (!isEditable) return;
        setEvents(events.map(ev => {
            if (ev.id !== eventId) return ev;
            const currentCount = ev.progress[selectedDateStr] || 0;
            return { ...ev, progress: { ...ev.progress, [selectedDateStr]: Math.max(0, currentCount + change) } };
        }));
    };

    const handleDeleteEvent = (eventId) => {
        if (!isEditable) return;
        setEvents(events.filter(ev => ev.id !== eventId));
    };

    return (
        <Paper elevation={3} className="events-paper">
            <Typography variant="h5" fontWeight="bold" gutterBottom>
                {isEditable ? "Today's Tasks" : `Tasks for ${selectedDate.format('DD/MM/YYYY')}`}
            </Typography>
            <Typography variant="caption" color={isEditable ? "text.secondary" : "warning.main"} gutterBottom>
                {isEditable ? "Editable until 6:00 AM tomorrow" : "Read-only history view"}
            </Typography>

            <Box className="task-list-wrapper">
                {displayEvents.length === 0 ? (
                    <Typography color="text.secondary" align="center" mt={5}>No tasks scheduled!</Typography>
                ) : (
                    displayEvents.map(ev => {
                        const current = ev.progress[selectedDateStr] || 0;
                        const isCompleted = current >= ev.targetCount;

                        return (
                            <Box
                                key={ev.id}
                                className="task-item"
                                sx={{
                                    bgcolor: isCompleted ? 'success.light' : 'action.hover',
                                    color: isCompleted ? 'success.contrastText' : 'text.primary',
                                }}
                            >
                                <Typography variant="body1" fontWeight="500" sx={{ wordBreak: 'break-word', pr: 1 }}>
                                    {ev.title}
                                </Typography>

                                <Box className="task-actions">
                                    {isEditable && <Button variant="contained" size="small" onClick={() => updateProgress(ev.id, -1)} sx={{ minWidth: '30px', p: 0 }}>-</Button>}
                                    <Typography variant="body2" sx={{ minWidth: '40px', textAlign: 'center' }}>{current} / {ev.targetCount}</Typography>
                                    {isEditable && (
                                        <>
                                            <Button variant="contained" size="small" onClick={() => updateProgress(ev.id, 1)} sx={{ minWidth: '30px', p: 0 }}>+</Button>
                                            <Button
                                                variant="text"
                                                color="error"
                                                size="small"
                                                onClick={() => handleDeleteEvent(ev.id)}
                                                sx={{ minWidth: '30px', p: 0, ml: 1 }}
                                                title="Delete Event"
                                            >
                                                <MdDeleteForever size={24} />
                                            </Button>
                                        </>
                                    )}
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Box>

            {isEditable && (
                <Button variant="contained" color="primary" fullWidth onClick={() => setDialogOpen(true)}>
                    + Add Event
                </Button>
            )}

            {/* DIALOG FORM */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Recurring Event</DialogTitle>
                <DialogContent className="dialog-form-content">
                    <TextField label="Event Title" fullWidth variant="outlined" sx={{ mt: 1 }} value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />

                    {/* NEW: Start and End Dates */}
                    <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                        <DatePicker
                            label="Start Date"
                            format="DD/MM/YYYY" // <-- ADD THIS LINE
                            value={newEvent.startDate}
                            onChange={(newValue) => setNewEvent({ ...newEvent, startDate: newValue })}
                            sx={{ flex: 1 }}
                        />
                        <DatePicker
                            label="End Date (Optional)"
                            format="DD/MM/YYYY" // <-- ADD THIS LINE
                            value={newEvent.endDate}
                            onChange={(newValue) => setNewEvent({ ...newEvent, endDate: newValue })}
                            sx={{ flex: 1 }}
                            slotProps={{ field: { clearable: true } }}
                        />
                    </Box>

                    <FormControl fullWidth>
                        <InputLabel>Show on days</InputLabel>
                        <Select value={newEvent.frequency} label="Show on days" onChange={(e) => setNewEvent({ ...newEvent, frequency: e.target.value })}>
                            <MenuItem value="all">Every day</MenuItem>
                            <MenuItem value="weekly">Every week</MenuItem>
                            <MenuItem value="monthly">Every month</MenuItem>
                            <MenuItem value="custom">Custom days</MenuItem>
                        </Select>
                    </FormControl>

                    {newEvent.frequency === 'custom' && (
                        <FormControl fullWidth>
                            <InputLabel>Select Days</InputLabel>
                            <Select multiple value={newEvent.customDays} onChange={(e) => setNewEvent({ ...newEvent, customDays: e.target.value })} input={<OutlinedInput label="Select Days" />} renderValue={(selected) => selected.map(val => DAYS_OF_WEEK[val].slice(0, 3)).join(', ')}>
                                {DAYS_OF_WEEK.map((day, index) => (
                                    <MenuItem key={day} value={index}>
                                        <Checkbox checked={newEvent.customDays.indexOf(index) > -1} />
                                        <ListItemText primary={day} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <TextField label="Target count per day" type="number" fullWidth inputProps={{ min: 1 }} value={newEvent.targetCount} onChange={(e) => setNewEvent({ ...newEvent, targetCount: parseInt(e.target.value) || 1 })} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddEvent}>Add Event</Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}

// --- 5. MAIN LAYOUT ---
export default function Dashboard() {
    const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'dark');
    const [events, setEvents] = useState(() => {
        const saved = localStorage.getItem('taskTrackerEvents');
        return saved ? JSON.parse(saved) : [];
    });
    const [selectedDate, setSelectedDate] = useState(dayjs(getLogicalDateStr()));

    useEffect(() => localStorage.setItem('themeMode', mode), [mode]);
    useEffect(() => localStorage.setItem('taskTrackerEvents', JSON.stringify(events)), [events]);

    const theme = createTheme({
        palette: {
            mode: mode,
            // 1. This changes your global "primary" color (affects your Add Event button)
            primary: {
                main: '#3F00FF', // A nice Deep Purple. Change this hex code to whatever you like!
                // Material-UI is smart enough to auto-generate the hover state and text color.
            },
            // 2. This keeps the vibrant green we added earlier
            success: {
                main: '#00e676',
                light: '#0BDA51',
                dark: '#FF5C00',
                contrastText: '#000000',
            }
        }
    });

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />

            {/* CRITICAL: We moved LocalizationProvider to wrap the whole app! 
        This allows the DatePickers inside the popup Dialog to work properly. 
      */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box className="dashboard-container">

                    <Button
                        variant="contained"
                        onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
                        sx={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}
                    >
                        {mode === 'light' ? 'Dark' : 'Light'} Mode
                    </Button>

                    <Box className="left-panel">
                        <AddEvents events={events} setEvents={setEvents} selectedDate={selectedDate} />
                    </Box>

                    <Box className="right-panel">
                        <Paper elevation={3} className="calendar-paper">
                            <DateCalendar
                                value={selectedDate}
                                onChange={(newDate) => setSelectedDate(newDate)}
                                slots={{ day: TaskTrackingDay }}
                                slotProps={{ day: { events: events } }}
                            />
                        </Paper>
                    </Box>

                </Box>
            </LocalizationProvider>
        </ThemeProvider>
    );
}