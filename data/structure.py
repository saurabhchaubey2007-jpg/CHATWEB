from pathlib import Path

PROJECT_NAME = "ChatWeb"

folders = [
    "backend",
    "extension",
]

files = {
    "backend": [
        "main.py",
        ".env",
        "requirements.txt",
    ],
    "extension": [
        "manifest.json",
        "popup.html",
        "popup.css",
        "popup.js",
    ]
}


def create_structure():
    root = Path.cwd()

    for folder in folders:
        (root / folder).mkdir(parents=True, exist_ok=True)

    for folder, file_list in files.items():
        for file_name in file_list:
            file_path = root / folder / file_name

            if not file_path.exists():
                file_path.touch()

    print("\nProject structure created successfully!\n")

    print(f"{PROJECT_NAME}/")
    print("│")
    print("├── backend/")
    print("│   ├── main.py")
    print("│   ├── .env")
    print("│   └── requirements.txt")
    print("│")
    print("└── extension/")
    print("    ├── manifest.json")
    print("    ├── popup.html")
    print("    ├── popup.css")
    print("    └── popup.js")


if __name__ == "__main__":
    create_structure()