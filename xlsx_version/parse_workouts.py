import pandas as pd
import json
from pathlib import Path
import datetime

def convert_for_json(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    return obj

def parse_workouts_excel():
    # Read the Excel file
    excel_path = Path('workouts.xlsx')
    if not excel_path.exists():
        print(f"Error: {excel_path} not found!")
        return

    # Read all sheets
    xl = pd.ExcelFile(excel_path)
    sheets_data = {}

    for sheet_name in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=sheet_name)
        # Convert DataFrame to dict, handling NaN values
        sheet_data = df.where(pd.notna(df), None).to_dict(orient='records')
        sheets_data[sheet_name] = sheet_data

    # Save to JSON file, handling datetime objects
    output_path = Path('workouts_data.json')
    with open(output_path, 'w') as f:
        json.dump(sheets_data, f, indent=2, default=convert_for_json)

    print(f"Successfully parsed Excel file and saved to {output_path}")
    
    # Print sheet names and their row counts for verification
    print("\nSheet contents summary:")
    for sheet_name, data in sheets_data.items():
        print(f"{sheet_name}: {len(data)} rows")

    # Programmatically extract unique values for completeness
    main_movements = set()
    accessory_movements = set()
    workout_formats = set()
    intensity_levels = set()

    for sheet_name, data in sheets_data.items():
        for row in data:
            if 'Unnamed: 3' in row and row['Unnamed: 3']:
                main_movements.add(row['Unnamed: 3'])
            if 'Unnamed: 5' in row and row['Unnamed: 5']:
                for movement in row['Unnamed: 5'].split(','):
                    accessory_movements.add(movement.strip())
            if 'Unnamed: 9' in row and row['Unnamed: 9']:
                for movement in row['Unnamed: 9'].split(','):
                    accessory_movements.add(movement.strip())
            if 'Unnamed: 8' in row and row['Unnamed: 8']:
                workout_formats.add(row['Unnamed: 8'])
            if 'Unnamed: 7' in row and row['Unnamed: 7']:
                intensity_levels.add(row['Unnamed: 7'])

    # Save extracted data to markdown files
    docs_dir = Path('../docs')
    docs_dir.mkdir(exist_ok=True)

    with open(docs_dir / 'movements.md', 'w') as f:
        f.write("# Movements Reference\n\n")
        f.write("## Main Movements\n")
        for movement in sorted(main_movements):
            f.write(f"- {movement}\n")
        f.write("\n## Accessory/Finisher Movements\n")
        for movement in sorted(accessory_movements):
            f.write(f"- {movement}\n")

    with open(docs_dir / 'workout_formats.md', 'w') as f:
        f.write("# Workout Formats Reference\n\n")
        for format in sorted(workout_formats):
            f.write(f"- {format}\n")

    with open(docs_dir / 'intensity_levels.md', 'w') as f:
        f.write("# Intensity Levels Reference\n\n")
        for level in sorted(intensity_levels):
            f.write(f"- {level}\n")

    print("\nExtracted data saved to markdown files in docs/")

if __name__ == "__main__":
    parse_workouts_excel() 