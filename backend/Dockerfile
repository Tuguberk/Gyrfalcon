FROM python:3.9-slim

# Set the working directory
WORKDIR /app

RUN pip install gunicorn

# Copy the requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code with the correct filename
COPY . .


# Expose the port the app runs on
EXPOSE 5001

# Command to run the application
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5001", "app:app"]