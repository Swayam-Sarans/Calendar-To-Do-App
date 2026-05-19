import React, { useState, useEffect } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import { DatePicker } from "@mui/x-date-pickers/DatePicker"; // NEW: For the form
import dayjs from "dayjs";
import { MdDeleteForever } from "react-icons/md";
import "../App.css";
import { IoMdCheckmarkCircleOutline } from "react-icons/io";

import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase.js";

import Login from "./Login.jsx";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase.js";

import { useAuth } from "../context/AuthContext.jsx";

// MUI Core imports
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  Box,
  Button,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Switch,
  FormControlLabel,
} from "@mui/material";

// --- 1. HELPER FUNCTIONS ---
const getLogicalDateStr = () => {
  return dayjs().subtract(6, "hour").format("YYYY-MM-DD");
};

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// --- 2. THE SMART FILTER LOGIC ---
// This checks if an event should be active on ANY given dayjs date
const isEventActiveOnDate = (ev, targetDayjs) => {
  const targetStr = targetDayjs.format("YYYY-MM-DD");

  // 1. Check Date Boundaries (This prevents tampering with past days!)
  if (targetStr < ev.startDate) return false;
  if (ev.endDate && targetStr > ev.endDate) return false;

  // 2. Check Frequency
  if (ev.frequency === "all") return true;
  if (ev.frequency === "custom")
    return ev.customDays.includes(targetDayjs.day());

  const startDayjs = dayjs(ev.startDate);
  // Weekly: Matches the same day of the week as the start date
  if (ev.frequency === "weekly") return targetDayjs.day() === startDayjs.day();
  // Monthly: Matches the same date of the month as the start date
  if (ev.frequency === "monthly")
    return targetDayjs.date() === startDayjs.date();

  return false;
};

// --- 3. CUSTOM CALENDAR DAY ---
function TaskTrackingDay(props) {
  const { day, outsideCurrentMonth, events, ...other } = props;

  if (outsideCurrentMonth) {
    return (
      <PickersDay
        day={day}
        outsideCurrentMonth={outsideCurrentMonth}
        {...other}
      />
    );
  }

  const dateStr = day.format("YYYY-MM-DD");
  const isToday = dayjs().isSame(day, "day");

  const scheduledEvents = events.filter((ev) => isEventActiveOnDate(ev, day));

  const isFullyCompleted =
    scheduledEvents.length > 0 &&
    scheduledEvents.every(
      (ev) => (ev.progress[dateStr] || 0) >= ev.targetCount,
    );

  return (
    <PickersDay
      day={day}
      outsideCurrentMonth={outsideCurrentMonth}
      {...other}
      sx={{
        "&.MuiPickersDay-today": {
          border: "none",
          backgroundColor: "transparent",
        },
        // Underline
        ...(isToday && {
          "&::after": {
            content: '""',
            position: "absolute",
            bottom: 1.5,
            left: "50%",
            transform: "translateX(-50%)",
            width: "22px",
            height: "3.5px",
            borderRadius: "10px",
            backgroundColor: "#3F00FF",
          },
        }),
        // Glowing Blue Dot
        // ...(isToday && {
        //   "&::after": {
        //     content: '""',
        //     position: "absolute",
        //     bottom: -1.8,
        //     left: "50%",
        //     transform: "translateX(-50%)",
        //     width: "7px",
        //     height: "7px",
        //     borderRadius: "50%",
        //     backgroundColor: "#3F00FF",
        //     boxShadow: "0 0 8px #3F00FF",
        //   },
        // }),

        position: "relative",

        "&:hover": {
          backgroundColor: "rgba(63, 0, 255, 0.18)",
        },
      }}
    >
      {isFullyCompleted ? (
        <IoMdCheckmarkCircleOutline size={30} color="#3F00FF" />
      ) : (
        day.date()
      )}
    </PickersDay>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);

const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

const PERIODS = ["AM", "PM"];

// --- 4. EVENTS COMPONENT ---
function AddEvents({ events, setEvents, selectedDate, currentUser }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const [is24HourFormat, setIs24HourFormat] = useState(() => {
    return localStorage.getItem("is24HourFormat") === "true";
  });

  useEffect(() => {
    localStorage.setItem("is24HourFormat", is24HourFormat);
  }, [is24HourFormat]);

  // Updated state to include dates
  const [newEvent, setNewEvent] = useState({
    title: "",
    frequency: "all",
    customDays: [],
    targetCount: 1,
    startHour: "",
    startMinute: "",
    startPeriod: "AM",

    endHour: "",
    endMinute: "",
    endPeriod: "AM",
    startDate: dayjs(getLogicalDateStr()), // Defaults to "today" (respecting the 6 AM rule)
    endDate: null,
  });

  const logicalTodayStr = getLogicalDateStr();
  const selectedDateStr = selectedDate.format("YYYY-MM-DD");
  const isEditable = selectedDateStr === logicalTodayStr;

  // Use the smart filter for the left panel too!
  const displayEvents = events
    .filter((ev) => isEventActiveOnDate(ev, selectedDate))
    .sort((a, b) => {
      const timeA = dayjs(`2000-01-01 ${a.startTime}`);
      const timeB = dayjs(`2000-01-01 ${b.startTime}`);

      return timeA.valueOf() - timeB.valueOf();
    });

  const handleAddEvent = async () => {
    if (
      !newEvent.title ||
      !newEvent.startDate ||
      !newEvent.targetCount ||
      !newEvent.startHour ||
      !newEvent.startMinute ||
      !newEvent.startPeriod ||
      !newEvent.endHour ||
      !newEvent.endMinute ||
      !newEvent.endPeriod
    ) {
      alert("Please fill all required fields");
      return;
    }

    const formattedStartTime = `${newEvent.startHour}:${newEvent.startMinute} ${newEvent.startPeriod}`;

    const formattedEndTime = `${newEvent.endHour}:${newEvent.endMinute} ${newEvent.endPeriod}`;

    const newTask = {
      title: newEvent.title,
      frequency: newEvent.frequency,
      customDays: newEvent.customDays,
      targetCount: newEvent.targetCount,
      startTime: formattedStartTime,
      endTime: formattedEndTime,

      startDate: newEvent.startDate.format("YYYY-MM-DD"),

      endDate: newEvent.endDate ? newEvent.endDate.format("YYYY-MM-DD") : null,

      progress: {},
    };

    try {
      // SAVE TO FIREBASE
      const docRef = await addDoc(
        collection(db, "users", currentUser.uid, "tasks"),
        newTask,
      );

      // SAVE TO LOCAL STATE USING FIREBASE ID
      setEvents([
        ...events,
        {
          id: docRef.id,
          ...newTask,
        },
      ]);

      setDialogOpen(false);

      // RESET FORM
      setNewEvent({
        title: "",
        frequency: "all",
        customDays: [],
        targetCount: 1,

        startHour: "",
        startMinute: "",
        startPeriod: "AM",

        endHour: "",
        endMinute: "",
        endPeriod: "AM",

        startDate: dayjs(getLogicalDateStr()),
        endDate: null,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateProgress = async (eventId, change) => {
    if (!isEditable) return;

    const updatedEvents = events.map((ev) => {
      if (ev.id !== eventId) return ev;

      const currentCount = ev.progress?.[selectedDateStr] || 0;

      const updatedProgress = {
        ...ev.progress,
        [selectedDateStr]: Math.max(0, currentCount + change),
      };

      return {
        ...ev,
        progress: updatedProgress,
      };
    });

    // Update local state first
    setEvents(updatedEvents);

    // Find updated event
    const updatedEvent = updatedEvents.find((ev) => ev.id === eventId);

    if (!updatedEvent) return;

    try {
      // SAVE TO FIREBASE
      await updateDoc(
        doc(db, "users", currentUser.uid, "tasks", String(eventId)),
        {
          progress: updatedEvent.progress,
        },
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!isEditable) return;

    await deleteDoc(
      doc(db, "users", currentUser.uid, "tasks", String(eventId)),
    );

    setEvents(events.filter((ev) => ev.id !== eventId));
  };

  return (
    <Paper
      elevation={3}
      className="events-paper"
      sx={{
        width: "650px",
        maxWidth: "95vw",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          {isEditable
            ? "Today's Tasks"
            : `Tasks for ${selectedDate.format("DD/MM/YYYY")}`}
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={is24HourFormat}
              onChange={() => setIs24HourFormat(!is24HourFormat)}
            />
          }
          label={is24HourFormat ? "24H" : "12H"}
          sx={{
            mr: 0,
            userSelect: "none",
          }}
        />
      </Box>
      <Typography
        variant="caption"
        color={isEditable ? "text.secondary" : "warning.main"}
        gutterBottom
      >
        {isEditable
          ? "Editable until 6:00 AM tomorrow"
          : "Read-only history view"}
      </Typography>

      <Box className="task-list-wrapper">
        {displayEvents.length === 0 ? (
          <Typography color="text.secondary" align="center" mt={5}>
            No tasks scheduled!
          </Typography>
        ) : (
          displayEvents.map((ev) => {
            const current = ev.progress[selectedDateStr] || 0;
            const isCompleted = current >= ev.targetCount;

            return (
              <Box
                key={ev.id}
                className="task-item"
                sx={{
                  background: isCompleted
                    ? "linear-gradient(135deg, #4776E6, #8E54E9)"
                    : undefined,
                  color: isCompleted ? "success.contrastText" : "text.primary",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 3,
                  width: "100%",
                  overflow: "hidden",
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="body1"
                  fontWeight="500"
                  sx={{
                    flex: 1,
                    pr: 2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: 1.3,
                    maxHeight: "2.6em",
                    wordBreak: "break-word",
                  }}
                >
                  {ev.title}
                </Typography>

                <Box className="task-actions">
                  {isEditable && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => updateProgress(ev.id, -1)}
                      sx={{ minWidth: "30px", p: 0 }}
                    >
                      -
                    </Button>
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      width: "60px",
                      textAlign: "center",
                      flexShrink: 0,
                      ml: 1,
                    }}
                  >
                    {current} / {ev.targetCount}
                  </Typography>
                  {isEditable && (
                    <>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => updateProgress(ev.id, 1)}
                        sx={{ minWidth: "30px", p: 0 }}
                      >
                        +
                      </Button>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        {ev.startTime && ev.endTime && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: isCompleted ? "black" : "text.secondary",
                              fontWeight: 500,
                              width: "fit-content",
                              minWidth: "fit-content",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                              fontVariantNumeric: "tabular-nums",
                              mr: 1,
                              ml: 2,
                            }}
                          >
                            {is24HourFormat
                              ? dayjs(
                                  `2000-01-01 ${ev.startTime}`,
                                  "YYYY-MM-DD hh:mm A",
                                ).format("HH:mm")
                              : dayjs(
                                  `2000-01-01 ${ev.startTime}`,
                                  "YYYY-MM-DD hh:mm A",
                                ).format("hh:mm A")}

                            {" - "}

                            {is24HourFormat
                              ? dayjs(
                                  `2000-01-01 ${ev.endTime}`,
                                  "YYYY-MM-DD hh:mm A",
                                ).format("HH:mm")
                              : dayjs(
                                  `2000-01-01 ${ev.endTime}`,
                                  "YYYY-MM-DD hh:mm A",
                                ).format("hh:mm A")}
                          </Typography>
                        )}

                        <Button
                          variant="text"
                          color="error"
                          size="small"
                          onClick={() => handleDeleteEvent(ev.id)}
                          sx={{ minWidth: "30px", p: 0 }}
                          title="Delete Event"
                        >
                          <MdDeleteForever size={24} />
                        </Button>
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {isEditable && (
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={() => setDialogOpen(true)}
        >
          + Add Event
        </Button>
      )}

      {/* DIALOG FORM */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Recurring Event</DialogTitle>
        <DialogContent className="dialog-form-content">
          <TextField
            label="Event Title"
            fullWidth
            variant="outlined"
            sx={{ mt: 1 }}
            value={newEvent.title}
            onChange={(e) =>
              setNewEvent({ ...newEvent, title: e.target.value })
            }
          />

          {/* NEW: Start and End Dates */}
          <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
            <DatePicker
              label="Start Date"
              format="DD/MM/YYYY" // <-- ADD THIS LINE
              value={newEvent.startDate}
              onChange={(newValue) =>
                setNewEvent({ ...newEvent, startDate: newValue })
              }
              sx={{ flex: 1 }}
            />
            <DatePicker
              label="End Date (Optional)"
              format="DD/MM/YYYY" // <-- ADD THIS LINE
              value={newEvent.endDate}
              onChange={(newValue) =>
                setNewEvent({ ...newEvent, endDate: newValue })
              }
              sx={{ flex: 1 }}
              slotProps={{ field: { clearable: true } }}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel>Show on days</InputLabel>
            <Select
              value={newEvent.frequency}
              label="Show on days"
              onChange={(e) =>
                setNewEvent({ ...newEvent, frequency: e.target.value })
              }
            >
              <MenuItem value="all">Every day</MenuItem>
              <MenuItem value="weekly">Every week</MenuItem>
              <MenuItem value="monthly">Every month</MenuItem>
              <MenuItem value="custom">Custom days</MenuItem>
            </Select>
          </FormControl>

          {newEvent.frequency === "custom" && (
            <FormControl fullWidth>
              <InputLabel>Select Days</InputLabel>
              <Select
                multiple
                value={newEvent.customDays}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, customDays: e.target.value })
                }
                input={<OutlinedInput label="Select Days" />}
                renderValue={(selected) =>
                  selected
                    .map((val) => DAYS_OF_WEEK[val].slice(0, 3))
                    .join(", ")
                }
              >
                {DAYS_OF_WEEK.map((day, index) => (
                  <MenuItem key={day} value={index}>
                    <Checkbox
                      checked={newEvent.customDays.indexOf(index) > -1}
                    />
                    <ListItemText primary={day} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Target count per day"
            type="number"
            fullWidth
            inputProps={{ min: 1 }}
            value={newEvent.targetCount}
            onChange={(e) =>
              setNewEvent({
                ...newEvent,
                targetCount: parseInt(e.target.value) || 1,
              })
            }
          />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="subtitle2">Start Time</Typography>

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Hour</InputLabel>
                <Select
                  value={newEvent.startHour}
                  label="Hour"
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      startHour: e.target.value,
                    })
                  }
                >
                  {HOURS.map((hr) => (
                    <MenuItem key={hr} value={hr}>
                      {hr}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Minute</InputLabel>
                <Select
                  value={newEvent.startMinute}
                  label="Minute"
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      startMinute: e.target.value,
                    })
                  }
                >
                  {MINUTES.map((min) => (
                    <MenuItem key={min} value={min}>
                      {min}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>AM/PM</InputLabel>
                <Select
                  value={newEvent.startPeriod}
                  label="AM/PM"
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      startPeriod: e.target.value,
                    })
                  }
                >
                  {PERIODS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Typography variant="subtitle2">End Time</Typography>

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Hour</InputLabel>
                <Select
                  value={newEvent.endHour}
                  label="Hour"
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      endHour: e.target.value,
                    })
                  }
                >
                  {HOURS.map((hr) => (
                    <MenuItem key={hr} value={hr}>
                      {hr}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Minute</InputLabel>
                <Select
                  value={newEvent.endMinute}
                  label="Minute"
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      endMinute: e.target.value,
                    })
                  }
                >
                  {MINUTES.map((min) => (
                    <MenuItem key={min} value={min}>
                      {min}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>AM/PM</InputLabel>
                <Select
                  value={newEvent.endPeriod}
                  label="AM/PM"
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      endPeriod: e.target.value,
                    })
                  }
                >
                  {PERIODS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddEvent}>
            Add Event
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// --- 5. MAIN LAYOUT ---
export default function Dashboard() {
  const { currentUser } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  const [mode, setMode] = useState(
    () => localStorage.getItem("themeMode") || "dark",
  );
  // const [events, setEvents] = useState(() => {
  //   const saved = localStorage.getItem("taskTrackerEvents");
  //   return saved ? JSON.parse(saved) : [];
  // });
  const [events, setEvents] = useState([]);

  const [selectedDate, setSelectedDate] = useState(dayjs(getLogicalDateStr()));

  // useEffect(() => {
  //   if (currentUser) {
  //     window.location.reload();
  //   }
  // }, [currentUser]);

  useEffect(() => localStorage.setItem("themeMode", mode), [mode]);
  useEffect(() => {
    async function fetchTasks() {
      if (!currentUser) return;

      const snapshot = await getDocs(
        collection(db, "users", currentUser.uid, "tasks"),
      );

      const tasks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setEvents(tasks);
    }

    fetchTasks();
  }, [currentUser]);
  // useEffect(
  //   () => localStorage.setItem("taskTrackerEvents", JSON.stringify(events)),
  //   [events],
  // );

  const theme = createTheme({
    palette: {
      mode: mode,
      // 1. This changes your global "primary" color (affects your Add Event button)
      primary: {
        main: "#3F00FF", // A nice Deep Purple. Change this hex code to whatever you like!
        // Material-UI is smart enough to auto-generate the hover state and text color.
      },
      // 2. This keeps the vibrant green we added earlier
      // success: {
      //   main: "#00e676",
      //   light: "#0BDA51",
      //   dark: "#FF5C00",
      //   contrastText: "#000000",
      // },
      success: {
        main: "#00FF85",
        light: "#0FFF50",
        dark: "#00CC6A",
        contrastText: "#000000",
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)}>
        <DialogContent>
          <Login setLoginOpen={setLoginOpen} />
        </DialogContent>
      </Dialog>

      {/* CRITICAL: We moved LocalizationProvider to wrap the whole app! 
        This allows the DatePickers inside the popup Dialog to work properly. 
      */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box
          className="dashboard-container"
          sx={{
            "--scroll-track": mode === "dark" ? "#111" : "#e0e0e0",
            "--scroll-thumb": mode === "dark" ? "#333" : "#b0b0b0",
            "--scroll-thumb-hover": mode === "dark" ? "#555" : "#888",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 20,
              right: 20,
              zIndex: 10,
              display: "flex",
              gap: 2,
            }}
          >
            <Button
              variant="contained"
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
            >
              {mode === "light" ? "Dark" : "Light"} Mode
            </Button>

            {!currentUser ? (
              <Button variant="outlined" onClick={() => setLoginOpen(true)}>
                Login / Signup
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="error"
                onClick={() => signOut(auth)}
              >
                Logout
              </Button>
            )}
          </Box>

          <Box className="left-panel">
            <AddEvents
              events={events}
              setEvents={setEvents}
              selectedDate={selectedDate}
              currentUser={currentUser}
            />
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
