const fs = require('fs');
const path = require('path');

const PROJECT_SUBDIRS = ['thumbnails', 'exports', 'exports/sequences', 'exports/zip'];

// Validate project path is properly isolated
function isInsideProject(projectPath, targetPath) {
  const projectDir = path.resolve(projectPath);
  const target = path.resolve(targetPath);
  return target.startsWith(projectDir + path.sep) || target === projectDir;
}

// Validate project path format
function validateProjectPath(projectPath) {
  try {
    const resolved = path.resolve(projectPath);
    if (!resolved || resolved.length < 3) {
      return { valid: false, error: 'Invalid project path' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Sanitize project name (prevent path traversal)
function sanitizeProjectName(name) {
  if (!name || typeof name !== 'string') {
    return 'Untitled Project';
  }

  // Remove path separators and suspicious characters
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .substring(0, 255)
    .trim() || 'Untitled Project';
}

// Create new project
function newProject(name, videoPath) {
  try {
    const sanitizedName = sanitizeProjectName(name);
    const projectName = `${sanitizedName}_${Date.now()}`;
    const projectPath = path.join(process.env.HOME || process.env.USERPROFILE, 'ShotSheetProjects', projectName);

    // Validate paths
    const validation = validateProjectPath(projectPath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Create project structure
    if (fs.existsSync(projectPath)) {
      return { success: false, error: 'Project already exists' };
    }

    fs.mkdirSync(projectPath, { recursive: true });

    // Create subdirectories
    PROJECT_SUBDIRS.forEach((subdir) => {
      const subdirPath = path.join(projectPath, subdir);
      fs.mkdirSync(subdirPath, { recursive: true });
    });

    // Create project.json
    const projectData = {
      name: sanitizedName,
      version: '1.0.0',
      videoPath: videoPath || null,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      scenes: [],
      frames: [],
      settings: {
        detectionThreshold: 0.3,
        autoSave: true,
      },
    };

    const projectJsonPath = path.join(projectPath, 'project.json');
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2), 'utf8');

    return {
      success: true,
      projectPath,
      projectName,
      data: projectData,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Open existing project
function openProject(projectPath) {
  try {
    const validation = validateProjectPath(projectPath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Pfad gegen homeDir validieren — verhindert Path-Traversal (fix #118)
    const os = require('os');
    const homeDir = os.homedir();
    const resolvedPath = path.resolve(projectPath);
    if (!resolvedPath.startsWith(homeDir + path.sep)) {
      return { success: false, error: 'Access denied: project path must be within home directory' };
    }

    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project not found' };
    }

    const projectJsonPath = path.join(projectPath, 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
      return { success: false, error: 'Invalid project: missing project.json' };
    }

    // Read and parse project.json
    let projectData;
    try {
      const content = fs.readFileSync(projectJsonPath, 'utf8');
      projectData = JSON.parse(content);
    } catch (error) {
      return { success: false, error: `Failed to parse project.json: ${error.message}` };
    }

    // Repair missing subdirectories
    PROJECT_SUBDIRS.forEach((subdir) => {
      const subdirPath = path.join(projectPath, subdir);
      if (!fs.existsSync(subdirPath)) {
        fs.mkdirSync(subdirPath, { recursive: true });
      }
    });

    return {
      success: true,
      projectPath,
      projectName: path.basename(projectPath),
      data: projectData,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Save project
function saveProject(projectPath, data) {
  try {
    const validation = validateProjectPath(projectPath);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Validate that project path is within the user's home directory
    const os = require('os');
    const homeDir = os.homedir();
    const resolvedPath = path.resolve(projectPath);
    if (!resolvedPath.startsWith(homeDir + path.sep)) {
      return { success: false, error: 'Project path must be within home directory' };
    }

    const projectJsonPath = path.join(projectPath, 'project.json');

    // Atomic write: write to temp file, then rename
    const tempPath = `${projectJsonPath}.tmp`;

    try {
      // Write to temp file
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');

      // Atomic rename (replaces target atomically on POSIX; works on Windows too)
      fs.renameSync(tempPath, projectJsonPath);

      return { success: true };
    } catch (error) {
      // Fallback for Windows: direct write if cross-device rename fails
      if (process.platform === 'win32') {
        fs.writeFileSync(projectJsonPath, JSON.stringify(data, null, 2), 'utf8');
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {
          // Ignore
        }
        return { success: true };
      }
      throw error;
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  newProject,
  openProject,
  saveProject,
  validateProjectPath,
  sanitizeProjectName,
  isInsideProject,
  PROJECT_SUBDIRS,
};
